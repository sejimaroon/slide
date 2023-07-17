const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const app = express();

app.get('/download', (req, res) => {
  // フロントエンドからのリクエストで受け取った画像データを取得
  const { images } = req.query;

  // 動画生成処理
  const command = ffmpeg();
  
  // 動画の設定を適用
  command.input(images)  // 画像データを入力として指定
         .output('output.mp4')  // 出力ファイル名を指定
         .videoCodec('libx264')  // 動画コーデックを指定
         .outputOptions(['-pix_fmt yuv420p']);  // 出力オプションを指定

  // 動画の生成とダウンロード
  command.on('end', () => {
    res.download('output.mp4');  // ダウンロードリンクを提供
  });
  command.run();
});

app.listen(8000, () => {
  console.log('Server is running on port 8000');
});
