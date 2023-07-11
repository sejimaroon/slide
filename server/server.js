import React from 'react';
import App from './../src/App';

const express = require('express');
const path = require('path');
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');
const fs = require('fs');
const bodyParser = require('body-parser');


const app = express();
const port = 4000;

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

    const slideDuration = autoplayDelay * images.length;
    const outputFilePath = path.join(tempDir, 'output.gif');

    await ffmpeg.run(
      '-framerate', '1',
      '-i', 'input_%d.jpg',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-s', '1340x670',
      '-filter_complex', `[0:v]split[v0][v1];[v0]format=yuva420p,fade=t=out:st=${slideDuration}:d=1:alpha=1[v0fade];[v1][v0fade]overlay=format=yuv420[out]`,
      '-map', '[out]',
      '-t', `${slideDuration}`,
      outputFilePath
    );

    const outputData = fs.readFileSync(outputFilePath);

    res.set('Content-Type', 'image/gif');
    res.set('Content-Disposition', 'attachment; filename="slideshow.gif"');
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.send(outputData);
  } catch (error) {
    console.error('Error generating gif:', error);
    res.status(500).json({ error: 'Failed to generate gif' });
  }
});

let autoplayDelay = 2;
let speed = 1000;
/*
let effect = 'default'; // 追加: デフォルトのアニメーション効果
*/

app.post('/slide/updateSettings', (req, res) => {
  const { autoplayDelay: newAutoplayDelay, speed: newSpeed} = req.body;

  // 再生時間の設定を更新
  autoplayDelay = newAutoplayDelay;
  speed = newSpeed;
  /*effect = newEffect;*/ // アニメーションの設定を更新

  res.send('Settings updated successfully.');
});

app.get('/slide/getSettings', (req, res) => {
  // 現在の再生時間とアニメーションの設定を返す
  res.json({ autoplayDelay, speed});
});


app.get('*', (req, res) => {
  const app = <App />;
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
