"use strict";

let chatGptContextFresh = true;

module.exports = {
  getChatGptContextFresh() {
    return chatGptContextFresh;
  },
  setChatGptContextFresh(val) {
    chatGptContextFresh = Boolean(val);
  }
};
