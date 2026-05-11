// app.js - Add session middleware
const session = require('express-session');
app.use(session({
  secret: 'hitEE#1725',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

const toolsRouter = require('./routes/tools');
app.use('/tools', toolsRouter);
