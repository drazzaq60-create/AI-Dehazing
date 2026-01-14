// const Log = require('../models/Log');

// const getEvaluationLogs = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const logs = await Log.find({ userId, type: 'yolo_results' }).sort({ timestamp: -1 }).limit(10);
//     res.json(logs);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// module.exports = { getEvaluationLogs };

const runEvaluation = async (req, res) => {
  try {
    res.json({ message: 'Evaluation completed successfully' });
  } catch (error) {
    console.error('Error running evaluation:', error);
    res.status(500).json({ message: 'Server error during evaluation' });
  }
};

module.exports = { runEvaluation };
