const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');

const uri = 'YOUR_MONGODB_ATLAS_URI';
const client = new MongoClient(uri);

router.post('/schedule', async (req, res) => {
  const {
    case_no,
    case_type,
    plaintiff_title,
    plaintiff_name,
    defendant_title,
    defendant_name,
    date,
    time,
    judge_matricule,
    clerk_matricule
  } = req.body;

  const proceeding_id = uuidv4();

  try {
    await client.connect();
    const database = client.db('court_assistant');
    const proceedings = database.collection('proceedings');

    const newProceeding = {
      proceeding_id,
      case_no,
      case_type,
      plaintiff: {
        title: plaintiff_title,
        name: plaintiff_name
      },
      defendant: {
        title: defendant_title,
        name: defendant_name
      },
      date,
      time,
      judge_matricule,
      clerk_matricule,
      created_at: new Date(),
      status: 'scheduled'
    };

    await proceedings.insertOne(newProceeding);
    res.status(200).json({ message: 'Proceeding scheduled successfully', proceeding_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to schedule proceeding' });
  } finally {
    await client.close();
  }
});

module.exports = router;
