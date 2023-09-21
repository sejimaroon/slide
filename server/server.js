import React from "react";
import App from "../src/App";
import ReactDOMServer from "react-dom/server";

const express = require("express");
const path = require("path");
const { createFFmpeg, fetchFile } = require("@ffmpeg/ffmpeg");
const fs = require("fs");
const bodyParser = require("body-parser");

const app = express();
const port = 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("./dist"));

const ffmpeg = createFFmpeg();

app.post("/slide/download", async (req, res) => {
  try {
    const { images, numImages, autoplayDelay, speed, filename, } = req.body; // 画像の配列と画像の数、autoplayDelay、speedを取得

    await ffmpeg.load();

    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const imagePaths = [];
    for (let i = 0; i < numImages; i++) {
      const image = images[i];
      const imagePath = path.join(tempDir, `image_${i}.jpg`);
      fs.writeFileSync(imagePath, image, "base64");
      imagePaths.push(imagePath);
    }

    ffmpeg.FS(
      "writeFiles",
      imagePaths.map((imagePath, index) => ({
        name: `input_${index}.jpg`,
        data: fetchFile(imagePath),
      }))
    );

    let filterComplex = "";

    for (let i = 0; i < numImages; i++) {
      filterComplex += `[${i}]settb=AVTB[v${i}];`;
    }

    let xfadeFilters = "";

    for (let i = 0; i < numImages - 1; i++) {
      const changeTime = speed / 1000;
      const offsetTime = autoplayDelay * (i + 1);

      if (i === 0) {
        xfadeFilters += `[v${i}][v${i + 1}]xfade=transition=fade:duration=${changeTime}:offset=${offsetTime}[v${i}${i + 1}];`;
      } else {
        xfadeFilters += `[v${i - 1}${i}][v${i + 1}]xfade=transition=fade:duration=${changeTime}:offset=${offsetTime}[v${i}${i + 1}];`;
      }
    }
    if (xfadeFilters.endsWith(";")) {
      xfadeFilters = xfadeFilters.slice(0, -1) /* + ','*/;
    }

    filterComplex += xfadeFilters;
    /*
  filterComplex += `scale=trunc(iw/2)*2:trunc(ih/2)*2[v]`;
  */

    let imageInputs = [];
    for (let i = 0; i < numImages; i++) {
      imageInputs.push(
        "-loop", "1",
        "-t", `${autoplayDelay + speed / 1000}`,
        "-i", `input_${i}.jpg`
      );
    }

    if (numImages > 1) {
      await ffmpeg.run(
        ...imageInputs,
        "-filter_complex", filterComplex,
        "-map", `[v${images.length - 2}${images.length - 1}]`,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-s", "1340x670",
        "output.mp4"
      );
    } else {
      await ffmpeg.run(
        ...imageInputs,
        "-filter_complex", filterComplex,
        "-map", "[v]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-s", "1340x670",
        "output.mp4"
      );
    }
    const outputFilePath = path.join(tempDir, "output.mp4");
    if (fs.existsSync(outputFilePath)) {
      const outputData = fs.readFileSync(outputFilePath);
      res.set("Content-Type", "video/mp4");
      res.set("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(outputData);
    } else {
      throw new Error("Output video file not found.");
    }
  } catch (error) {
    console.error("Error generating video:", error);
    res.status(500).json({ error: "Failed to generate video" });
  }
});

app.get("*", (req, res) => {
  const app = ReactDOMServer.renderToString(<App />);
  const html = `
    <html>
    <head>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%%22 y=%2250%%22 style=%22dominant-baseline:central;text-anchor:middle;font-size:90px;%22>Ⓢ</text></svg>">
    <meta name="viewport" content="width=device-width, initial-scale=1">

      <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">
      <meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp">
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-LVFE3VXF8F"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', 'G-LVFE3VXF8F');
      </script>
    </head>
    <body>
      <div id="root">${app}</div>
      <script src="client.bundle.js"></script>
    </body>
    </html>
  `;
  console.log(html);
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.send(html);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
