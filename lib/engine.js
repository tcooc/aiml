var AiEngine, _, async, mustache;

_ = require('underscore');

async = require('async');

mustache = require('mustache');

AiEngine = (function() {
  function AiEngine(roomName, topics, botData) {
    this.roomName = roomName;
    this.topics = topics;
    if (!this.topics) {
      throw "Topics not found";
    }
    if (!this.roomName) {
      throw "Room name is undefined not found";
    }
    this.view = {
      topic: null,
      bot: botData,
      set: (function(_this) {
        return function(name, value) {
          console.log('dfdfdfdf');
          return _this.view[name] = value;
        };
      })(this),
      get: (function(_this) {
        return function(name) {
          return _this.view[name] || '';
        };
      })(this)
    };
    _.each(this.topics, (function(_this) {
      return function(topic) {
        return _.each(topic.categories, function(category) {
          var e, error;
          try {
            return category["room:" + _this.roomName] = new RegExp(category.pattern.replace('*', '([^/?!.;:$]*)'), "i");
          } catch (error) {
            e = error;
            return console.log('failed to compile pattern ', category.pattern);
          }
        });
      };
    })(this));
  }

  AiEngine.prototype.getCurrentTopic = function() {
    return _.find(this.topics, (function(_this) {
      return function(topic) {
        return topic.name === _this.view.topic;
      };
    })(this));
  };

  AiEngine.prototype.findCategory = function(message) {
    var topic;
    topic = this.getCurrentTopic();
    if (!topic) {
      return this.view.topic = null;
    }
    return _.find(topic.categories, (function(_this) {
      return function(category) {
        return category["room:" + _this.roomName].test(message);
      };
    })(this));
  };

  AiEngine.prototype.reply = function(authorData, message, cb) {
    var category, match, ref, responce;
    category = this.findCategory(message);
    if (!category) {
      return cb(null);
    }
    if ((ref = category.template) != null ? ref.link : void 0) {
      return this.reply(authorData, category.template.link, cb);
    }
    match = category["room:" + this.roomName].exec(message);
    if (match && match.length > 0) {
      this.view.star = match[1];
    }
    if (category.template["do"]) {
      category.template["do"](this.view, this.view.star);
    }
    responce = mustache.render(category.template.text, this.view);
    return cb(null, responce);
  };

  return AiEngine;

})();

module.exports = AiEngine;
