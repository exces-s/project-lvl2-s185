import yaml from 'js-yaml';
import ini from 'ini';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';

const selectParser = {
  '.json': JSON.parse,
  '.yml': yaml.safeLoad,
  '.ini': ini.parse,
};

const getParser = dataType => selectParser[dataType];

const parseData = (data, dataType) => {
  const parse = getParser(dataType);
  return parse(data);
};

// const parseAST = (data) => {
//   const keys = Object.keys(data);
//   const result = keys.reduce((acc, key) => {
//     if (data[key] instanceof Object) {
//       const obj = { key, value: '', children: parseAST(data[key]) };
//       return [...acc, obj];
//     }
//     if (!(data[key] instanceof Object)) {
//       const obj = { key, value: data[key], children: [] };
//       return [...acc, obj];
//     }
//     return null;
//   }, []);
//   return result;
// };

const buildAst = (dataBefore, dataAfter) => {
  const keysDataBefore = Object.keys(dataBefore);
  const keysDataAfter = Object.keys(dataAfter);

  const unionKeys = _.union(keysDataBefore, keysDataAfter);
  const ast = unionKeys.map((key) => {
    if (Object.keys(dataBefore).length === 0) {
      return { key, valueBefore: '', valueAfter: dataAfter[key], type: 'unchanged', children: [] };
    }
    if (Object.keys(dataAfter).length === 0) {
      return { key, valueBefore: dataBefore[key], valueAfter: '', type: 'unchanged', children: [] };
    }
    if (dataBefore[key] instanceof Object || dataAfter[key] instanceof Object) {
      if (JSON.stringify(dataBefore[key]) === JSON.stringify(dataAfter[key])) {
        return { key, valueBefore: '', valueAfter: '', type: 'unchanged', children: buildAst(dataBefore[key], dataAfter[key]) };
      }
      if (!dataBefore[key]) {
        return { key, valueBefore: '', valueAfter: '', type: 'added', children: buildAst({}, dataAfter[key]) };
      }
      if (!dataAfter[key]) {
        return { key, valueBefore: '', valueAfter: '', type: 'removed', children: buildAst(dataBefore[key], {}) };
      }
      if (!(dataBefore[key] instanceof Object)) {
        return { key, valueBefore: dataBefore[key], valueAfter: '', type: 'changed', children: buildAst({}, dataAfter[key]) };
      }
      if (!(dataAfter[key] instanceof Object)) {
        return { key, valueBefore: '', valueAfter: dataAfter[key], type: 'changed', children: buildAst(dataBefore[key], {}) };
      }
      if (dataBefore[key] instanceof Object && dataAfter[key] instanceof Object ) {

        return { key, valueBefore: '', valueAfter: '', type: 'changed', children: buildAst(dataBefore[key], dataAfter[key]) };
      }
    }
    if (!(key in dataAfter) && !(dataBefore[key] instanceof Object)) {
      return { key, valueBefore: dataBefore[key], valueAfter: '', type: 'removed', children: [] };
    }
    if (!(key in dataBefore) && !(dataBefore[key] instanceof Object)) {
      return { key, valueBefore: '', valueAfter: dataAfter[key], type: 'added', children: [] };
    }
    if (dataBefore[key] === dataAfter[key]) {
      const res = { key, valueBefore: dataAfter[key], valueAfter: dataAfter[key], type: 'unchanged', children: [] };
      return res;
    }
    if (key in dataAfter && key in dataBefore) {
      return { key, valueBefore: dataBefore[key], valueAfter: dataAfter[key], type: 'changed', children: [] };
    }
    return null;
  });

  return ast;
};

const render = (ast) => {
  const diff = (node) => {
    if (node.type === 'unchanged' && node.children.length === 0) {
      return `  ${node.key}: ${node.valueAfter}`;
    }
    if (node.type === 'added' && node.children.length === 0) {
      return `+ ${node.key}: ${node.valueAfter}`;
    }
    if (node.type === 'removed' && node.children.length === 0) {
      return `- ${node.key}: ${node.valueBefore}`;
    }
    if (node.type === 'changed' && node.children.length === 0) {
      return [`- ${node.key}: ${node.valueBefore}\n+ ${node.key}: ${node.valueAfter}`];
    }
    if (node.type === 'unchanged' && node.children.length > 0) {
      return `  ${node.key}: ${render(node.children)}`;
    }
    if (node.type === 'added' && node.children.length > 0) {
      return `+ ${node.key}: ${render(node.children)}`;
    }
    if (node.type === 'removed' && node.children.length > 0) {
      return `- ${node.key}: ${render(node.children)}`;
    }
    if (node.type === 'changed' && node.children.length > 0) {
      return `  ${node.key}: ${render(node.children)}`;
    }
    return null;
  };

  const arr = ast.map(node => diff(node));
  const result = ['{', ...arr, '}', ''].join('\n');
  return result;
};


const diffSearch = (dataBefore, dataAfter) => {
  const keysDataBefore = Object.keys(dataBefore);
  const keysDataAfter = Object.keys(dataAfter);

  const unionKeys = _.union(keysDataBefore, keysDataAfter);
  const arr = unionKeys.map((key) => {
    if (!(key in dataAfter)) {
      return `- ${key}: ${dataBefore[key]}`;
    }
    if (!(key in dataBefore)) {
      return `+ ${key}: ${dataAfter[key]}`;
    }
    if (dataBefore[key] === dataAfter[key]) {
      return `  ${key}: ${dataAfter[key]}`;
    }
    if (key in dataAfter && key in dataBefore) {
      return [`- ${key}: ${dataBefore[key]}`,
        `+ ${key}: ${dataAfter[key]}`];
    }
    return null;
  });

  const result = `{\n${_.flatten(arr).join('\n')}\n}\n`;
  return result;
};

const displayOutput = (resultString) => {
  console.log(resultString);
  return resultString;
};

const genDiff = (fileBefore, fileAfter) => {
  const typeFileBefore = path.extname(fileBefore);
  const typeFileAfter = path.extname(fileAfter);

  const dataBefore = fs.readFileSync(fileBefore, 'utf8');
  const dataAfter = fs.readFileSync(fileAfter, 'utf8');
  const parsedDataBefore = parseData(dataBefore, typeFileBefore);
  const parsedDataAfter = parseData(dataAfter, typeFileAfter);

  const ast = buildAst(parsedDataBefore, parsedDataAfter);
  const diff = render(ast);

  // const diffInArray = diffSearch(parsedDataBefore, parsedDataAfter);
  return displayOutput(diff);
};

export default genDiff;
