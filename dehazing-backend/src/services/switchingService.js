// const modes = {};
// exports.getMode = (userId) => modes[userId] || 'cloud';
// exports.switchMode = (userId, newMode) => { modes[userId] = newMode; };

const modes = {};

exports.getMode = (userId) => modes[userId] || 'cloud';
exports.switchMode = (userId, newMode) => { 
  modes[userId] = newMode; 
  console.log(`🔄 User ${userId} switched to ${newMode} mode`);
};
