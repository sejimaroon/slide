import React from 'react';
import App from '../src/App';
import ReactDOMServer from 'react-dom/server';

const express = require('express');
const path = require('path');
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = 4000;

let autoplayDelay = 2;
let speed = 1000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('./dist'));

const ffmpeg = createFFmpeg({ log: true });

app.post('/slide/download', async (req, res) => {
  try {
    const images = req.body;
    await ffmpeg.load();

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const imagePaths = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imagePath = path.join(tempDir, `image_${i}.jpg`);
      fs.writeFileSync(imagePath, image, 'base64');
      imagePaths.push(imagePath);
    }

    ffmpeg.FS('writeFiles', imagePaths.map((imagePath, index) => ({
      name: `input_${index}.jpg`,
      data: fetchFile(imagePath),
    })));

    const outputFilePath = path.join(tempDir, 'output.mp4');
    const pageSpeed = speed / 1000;

    await ffmpeg.run(
      '-loop','1',
      '-t', `2`,
      '-i', 'input_0.jpg',
      '-loop','1',
      '-t', `4`,            
      '-i', 'input_1.jpg',
      '-loop','1',
      '-t', `6`,            
      '-i', 'input_2.jpg',
      '-loop','1',
      '-t', `8`,            
      '-i', 'input_3.jpg',
      '-loop','1',
      '-t', `10`,            
      '-i', 'input_4.jpg',
      '-filter_complex', 
      `[0]settb=AVTB[v0];[1]settb=AVTB[v1];[2]settb=AVTB[v2];[3]settb=AVTB[v3];[4]settb=AVTB[v4];
      [v0][v1]xfade=transition=fade:duration=${pageSpeed}:offset=${autoplayDelay - pageSpeed}[v01];
      [v2][v3]xfade=transition=fade:duration=${pageSpeed}:offset=${autoplayDelay - pageSpeed}[v23];
      [v01][v23]xfade=transition=fade:duration=${pageSpeed}:offset=${autoplayDelay - pageSpeed}[v0123];
      [v0123][v4]xfade=transition=fade:duration=${pageSpeed}:offset=${autoplayDelay - pageSpeed},
      scale=trunc(iw/2)*2:trunc(ih/2)*2[v]`,          
      '-map', '[v]',       
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-s', '1340x670',
      'output.mp4'
    );

    if (fs.existsSync(outputFilePath)) {
      const outputData = fs.readFileSync(outputFilePath);
      res.set('Content-Type', 'video/mp4');
      res.set('Content-Disposition', 'attachment; filename="slideshow.mp4"');
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.setHeader('Permissions-Policy', 'interest-cohort=()');
      res.send(outputData);
    } else {
      throw new Error('Output video file not found.');
    }
  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});
app.post('/slide/updateSettings', (req, res) => {
  const { autoplayDelay: newAutoplayDelay, speed: newSpeed } = req.body;
  autoplayDelay = newAutoplayDelay;
  speed = newSpeed;

  res.send('Settings updated successfully.');
});

app.get('/slide/getSettings', (req, res) => {
  res.json({ autoplayDelay, speed });
});

app.get('*', (req, res) => {
  const app = ReactDOMServer.renderToString(<App />);
  const html = `
    <html>
    <head>
      <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">
      <meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp">
    </head>
    <body>
      <div id="root">${app}</div>
      <script src="client.bundle.js"></script>
    </body>
    </html>
  `;
  console.log(html);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.send(html);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});