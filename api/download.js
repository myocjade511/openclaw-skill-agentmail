// Simple API endpoint to serve the skill zip file
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const filePath = path.join(__dirname, '..', 'agentmail-skill.zip');
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Skill package not found' });
    return;
  }
  
  // Set headers for file download
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="agentmail-skill.zip"');
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
};
