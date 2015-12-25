var DomJS, _, async, engine, fs, mustache, parse, parseCategories, parseCategory, parseDir, parseFiles, parseMixedPatternExpression, parseMixedTemplateContentContainer, parsePatternExpression, parseTemplateExpression, parseTopic, parseTopics, path, processSetter, trim;

fs = require('fs');

path = require('path');

_ = require('underscore');

async = require('async');

DomJS = require("dom-js").DomJS;

mustache = require('mustache');

engine = require('./engine');

parse = function(xml, cb) {
  var domjs;
  if (!xml) {
    return cb('Xml is not defined');
  }
  domjs = new DomJS();
  return domjs.parse(xml, function(err, dom) {
    var topCategories, topics;
    if (err) {
      return cb(err);
    }
    if (dom.name === !'aiml') {
      return cb('Unsupported file');
    }
    topics = parseTopics(dom);
    topCategories = parseCategories(dom);
    if (topCategories.length > 0) {
      topics.unshift({
        name: null,
        categories: topCategories
      });
    }
    return cb(null, topics);
  });
};

parseFiles = function(files, cb) {
  var parseTasks;
  if (!_.isArray(files)) {
    files = [files];
  }
  parseTasks = _.map(files, function(file) {
    return function(cb) {
      return fs.readFile(file, 'utf8', function(err, data) {
        if (err) {
          return cb(err);
        }
        return parse(data, cb);
      });
    };
  });
  return async.parallel(parseTasks, function(err, results) {
    var all, merged, result;
    if (err) {
      return cb(err);
    }
    all = _.flatten(results, true);
    merged = _.groupBy(all, 'name');
    result = _.map(merged, function(arr) {
      return {
        name: arr[0].name,
        categories: _.reduce(arr, (function(acc, next) {
          return acc.concat(next.categories);
        }), [])
      };
    });
    return cb(null, result);
  });
};

parseDir = function(dir, cb) {
  return fs.readdir(dir, function(err, files) {
    if (err) {
      return cb(err);
    }
    files = _.map(files, function(file) {
      return path.join(dir, file);
    });
    return parseFiles(files, cb);
  });
};

parseTopics = function(node) {
  var topics;
  topics = _.filter(node.children, function(child) {
    return child.name === 'topic';
  });
  return _.map(topics, parseTopic);
};

parseTopic = function(node) {
  return {
    name: node.attributes.name,
    categories: parseCategories(node)
  };
};

parseCategories = function(node) {
  var categories;
  categories = _.filter(node.children, function(child) {
    return child.name === 'category';
  });
  return _.map(categories, parseCategory);
};

parseCategory = function(node) {
  var pattern, template, that;
  pattern = _.find(node.children, function(child) {
    return child.name === 'pattern';
  });
  that = _.find(node.children, function(child) {
    return child.name === 'that';
  });
  template = _.find(node.children, function(child) {
    return child.name === 'template';
  });
  var result = {
	pattern: parseMixedPatternExpression(pattern),
	that: that ? parseMixedPatternExpression(that) : null,
    template: parseMixedTemplateContentContainer(template)
  };
  return result;
};

parseMixedPatternExpression = function(node) {
  if (!node) {
    return void 0;
  }
  return _.reduce(node.children, (function(acc, next) {
    return "" + acc + (parsePatternExpression(next));
  }), '');
};

parsePatternExpression = function(node) {
  if (node.name === 'bot') {
    return "{{bot." + node.attributes.name + "}}";
  }
  return node.text;
};

parseMixedTemplateContentContainer = function(node) {
  var linkNode, setterNode, simpleNodes;
  if (!node) {
    return void 0;
  }
  linkNode = _.find(node.children, function(subNode) {
    return subNode.name === 'srai';
  });
  if (linkNode) {
    return {
      link: linkNode.children[0].text
    };
  }
  setterNode = _.find(node.children, function(subNode) {
    return subNode.name === 'set';
  });
  simpleNodes = _.filter(node.children, function(subNode) {
    return subNode.name === 'bot' || subNode.name === 'star' || subNode.text;
  });
  var result = {};
  result.text = trim(_.reduce(simpleNodes, (function(acc, next) {
	return "" + acc + (parseTemplateExpression(next));
  }), ''));
  if (setterNode) {
	result["do"] = processSetter(setterNode);
  }
  return result;
};

parseTemplateExpression = function(node) {
  if (node.name) {
    if (node.name === 'bot') {
      return "{{bot." + node.attributes.name + "}}";
    }
    if (node.name === 'star') {
      return "{{star}}";
    }
    if (node.name === 'get') {
      return "{{" + node.attributes.name + "}}";
    }
    return '';
  }
  return node.text;
};

processSetter = function(node) {
  var content, value;
  value = parseMixedTemplateContentContainer(node);
  content = value.text;
  if ((content.indexOf('{{star}}')) !== -1) {
    return function(state, star) {
      return state[node.attributes.name] = mustache.render(content, {
        star: star
      });
    };
  }
  return function(state) {
    return state[node.attributes.name] = content;
  };
};

trim = function(string) {
  return string.replace(/^\s+|\s+$/g, '');
};

module.exports.parse = parse;

module.exports.parseFiles = parseFiles;

module.exports.parseDir = parseDir;
