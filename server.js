require('dotenv').config();
const authMiddleware = require('./middleware/authMiddleware');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');

const folderRoutes = require('./routes/folderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const activityRoutes = require('./routes/activityRoutes');
const announcementRoutes =
  require('./routes/announcementRoutes');
const documentTypeRoutes =
  require('./routes/documentTypeRoutes');
const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/activity', activityRoutes);
app.use(
  '/api/announcements',
  announcementRoutes
);
app.use(
  '/api/document-types',
  documentTypeRoutes
);
app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({
    message: 'Protected route accessed',
    user: req.user,
  });
});
app.get('/', (req, res) => {
  res.send('Server Running');
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
});