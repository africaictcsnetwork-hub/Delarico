/* eslint-disable */
'use strict';

const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'production';

const bundlePath = path.join(__dirname, 'dist-server', 'server.cjs');

if (!fs.existsSync(bundlePath)) {
  console.error(
    '[DELARICO] Production server bundle not found at dist-server/server.cjs. Run "npm run build" first.'
  );
  process.exit(1);
}

require(bundlePath);
