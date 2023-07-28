import React, { useState, useRef, useEffect } from 'react';
import { Navigation, Pagination, Scrollbar, A11y, Autoplay, EffectFade} from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import './App.css';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';
import 'swiper/css/effect-fade';

import Dropzone from 'react-dropzone';
import Compressor from 'compressorjs';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import axios from 'axios';

const ffmpeg = createFFmpeg({ log: true });

const App = () => {
  const [images, setImages] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isConverting, setIsConverting] = useState(false);

  const swiperRef = useRef(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [autoplayDelay, setAutoplayDelay] = useState(2);
  const [speed, setSpeed] = useState(1000);

  //ドロップゾーンに画像を送りスライドショーを作成
  const handleDrop = async (acceptedFiles) => {
  //スライドショー用に画像の変換
    const compressedImages = [];

    for (const file of acceptedFiles) {
      const compressedImage = await new Promise((resolve) => {
        new Compressor(file, {
          quality: 1,
          success(result) {
            resolve(result);
          },
          error(err) {
            console.error(err);
            resolve(null);
          },
        });
      });

      if (compressedImage) {
        compressedImages.push(compressedImage);
      }
    }

    
    setImages((prevImages) => [
      ...prevImages,
      ...compressedImages.map((image) => ({ file: image, name: image.name })),
    ]);
  };

  //autoplay切り替え
  const toggleAutoplay = () => {
    setAutoplay((prevAutoplay) => !prevAutoplay);
  };

  //表示時間変更
  const handleAutoplayDelayChange = (event) => {
    const newDelay = parseInt(event.target.value);
    setAutoplayDelay(newDelay >= 0 ? newDelay : 0);
  };
  
  //ページ送り時間変更
  const handleSpeedChange = (event) => {
    const newSpeed = parseInt(event.target.value);
    setSpeed(newSpeed >= 0 ? newSpeed : 0);
  };
  //設定の変更を反映
  const handleApplySettings = () => {
    if (swiperRef.current) {
      const swiper = swiperRef.current.swiper;
      swiper.params.autoplay = autoplay ? { delay: autoplayDelay * 1000 } : false;
      swiper.params.speed = speed >= 0 ? speed : 0;

      swiper.update();
      swiper.autoplay.start();

      const requestBody = {
        autoPlayDelay: autoplayDelay,
        speed: speed,
      };
  
      axios.post('/slide/updateSettings', requestBody)
        .then(response => {
          console.log(response.data);
        })
        .catch(error => {
          console.error(error);
        });
    }
  };
  //単一のスライドをキャプチャ
  const captureSlide = async (slide) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = slide.offsetWidth;
    canvas.height = slide.offsetHeight;

    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, slide.offsetWidth, slide.offsetHeight);
        //canvasに描画された画像をJPEG形式のデータURLとして取得
        resolve(canvas.toDataURL('image/jpeg', 1.0));
      };
      image.crossOrigin = 'anonymous'; 
      image.src = slide.children[0].src;
    });
  };
  //全てのスライドをキャプチャ
  const captureSlides = async () => {
    const swiper = swiperRef.current.swiper;
    //全てのスライド要素を取得
    const slideElements = swiper.el.children[0].querySelectorAll('.swiper-slide');

    const capturedSlides = [];

    //各スライド要素に対してcaptureSlide関数を呼び出す
    for (const slide of slideElements) {
      const capturedSlide = await captureSlide(slide);
      capturedSlides.push(capturedSlide);
    }

    return capturedSlides;
  };

 // 変換中の状態を設定し、captureSlidesで各スライドの画像データをキャプチャ。完了したら、setCapturedImages(capturedSlides) を呼び出してキャプチャされた画像データを状態に設定し、setIsConverting(false) を呼び出して変換が終了したことを示します。
  const handleConvert = async () => {
    setIsConverting(true);

    try {
      const capturedSlides = await captureSlides();
      setCapturedImages(capturedSlides);
      setIsConverting(false);
    } catch (error) {
      console.error(error);
      setIsConverting(false);
    }
  };

  //setIsConverting(true) を呼び出してダウンロード中の状態を設定し、captureSlides 関数を使用して各スライドの画像データをキャプチャ。完了したら、setCapturedImages(capturedSlides)で画像データを状態に設定。

  const handleDownload = async () => {
    setIsConverting(true);
  
    try {
      const capturedSlides = await captureSlides();
      setCapturedImages(capturedSlides);
  
      //ffmpeg.load()でffmpeg使用。ffmpeg.setProgressで状況をコンソールに。各スライドの画像データをffmpeg.FS('writeFile', ...)でFFmpegに。
      await ffmpeg.load();
      ffmpeg.setProgress(({ ratio }) => {
        console.log(`Conversion progress: ${Math.round(ratio * 100)}%`);
      });
      //各キャプチャされたスライドの画像データに対してループを実行
      for (let i = 0; i < capturedSlides.length; i++) {
        const slide = capturedSlides[i];
        //キャプチャされたスライドのDataURLから画像データを取得、fetchFile は、DataURLをUint8Arrayに変換して返す非同期関数
        const imageData = await fetchFile(slide);
        //取得した画像データをFFmpegに渡す
        ffmpeg.FS('writeFile', `input_${i}.jpg`, imageData);
      } 
      
      const framerate = 1 / autoplayDelay;

      //ffmpeg動画設定
      await ffmpeg.run(       
        //ページ送りの速度
        '-framerate', `${framerate}`,
        //無限ループ
        '-loop','1',
        //入力ファイルを指定します。%dは連番の画像ファイルを表すプレースホルダー
        '-i', 'input_%d.jpg',
        // 'filter_complex', `[0][1][2][3][4][5][6][7][8][9]xfade=transition=fade:duration=${framerate}:offset=${autoplayDelay},format=yuv420p`,
        //scaleフィルターで画像の解像度を指定。fadeフィルターでフェードインとフェードアウトの効果
        '-vf', `scale=trunc(iw/2)*2:trunc(ih/2)*2`,
        //`-filter_complex "xfade=transition=fade:duration=${speed}"`,
        //解像度を指定
        '-s', '1340x670',
        //H.264コーデック
        '-c:v', 'libx264',
        //ピクセルフォーマットを指定
        '-pix_fmt', 'yuv420p',
        //動画の解像度を指定
        '-s', '1340x670',
        //動画の長さ
        '-t', `${autoplayDelay * images.length }`,
        //ファイル名を指定
        'output.mp4'
        /*
        '-loop','1',
        '-i', 'input_%d.jpg',
        '-filter_complex', `[_%d]fade=d=${framerate}:t=in:alpha=1,setpts=PTS-STARTPTS + ${autoplayDelay}/TB[f0];[2]fade=d=${framerate}:t=in:alpha=1,setpts=PTS-STARTPTS + ${autoplayDelay * 2 }/TB[f1]; [3]fade=d=${framerate}:t=in:alpha=1,setpts=PTS-STARTPTS +  ${autoplayDelay * 3 }/TB[f2];[4]fade=d=${framerate}:t=in:alpha=1,setpts=PTS-STARTPTS +  ${autoplayDelay * 4 }/TB[f3];[0][f0]overlay[bg1];[bg1][f1]overlay[bg2];[bg2][f2]overlay[bg3];[bg3][f3]overlay,format=yuv420p[v]`,
        '-s', '1340x670',
        '-c:v', 'libx264',
        "output.mp4"
        */
      );
  
      // ffmpeg.FS を使用して、出力された動画ファイル output.mp4 のデータを取得
      const outputData = ffmpeg.FS('readFile', 'output.mp4');
      //Blob オブジェクトを使用して、動画データを Blob オブジェクトに変換、Blob オブジェクトのURLを作成
      const url = URL.createObjectURL(new Blob([outputData.buffer], { type: 'video/mp4' }));
      //ダウンロード用のリンク要素 a を作成
      const link = document.createElement('a');
      //一時的なオブジェクトURLを設定
      link.href = url;
      // リンクの download 属性を設定して、ダウンロード時のファイル名を指定。
      link.setAttribute('download', 'slideshow.mp4');
      //リンク要素を body 要素に追加
      document.body.appendChild(link);
      // リンクを自動的にクリックすることで、ダウンロードがトリガー
      link.click();
      //リンク要素をDOMから削除
      link.remove();
      //一時的なオブジェクトURLを解放
      URL.revokeObjectURL(url);
      // 変換中の状態を false に設定して、変換が完了
      setIsConverting(false);

    } catch (error) {
      console.error(error);
      setIsConverting(false);
    }
  };

  //ウィンドウの高さに応じてviewportHeightの値を////
  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };
    //コンポーネントがマウントされたときに初期のウィンドウの高さを設定
    handleResize(); 

    window.addEventListener('resize', handleResize); 

    return () => {
      window.removeEventListener('resize', handleResize); 
    };
  }, []);

  return (
    <section id="testimonials">
      <div className="container" style={{ height: `${viewportHeight}px` }}>
        <h1>App</h1>
        <Dropzone onDrop={handleDrop}>
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              style={{ width: '90%', height: '100px', border: '1px dashed black', marginLeft: '5%' }}
              className="dropzone"
            >
              <input {...getInputProps()} />
              <p>クリックして画像をドラッグ＆ドロップ</p>
            </div>
          )}
        </Dropzone>
        <div className="settings">
          <div>
            <label>
              <input type="checkbox" checked={autoplay} onChange={toggleAutoplay} />
              Autoplay
            </label>
          </div>
          <div>
            <label>
              Autoplay Delay (seconds):
              <input type="text" value={autoplayDelay} onChange={handleAutoplayDelayChange} />         
            </label>
          </div>
          <div>
            <label>
              PageSpeed:
              <input type="text" value={speed} onChange={handleSpeedChange} />
              ミリ秒
            </label>
          </div>
          <button onClick={handleApplySettings}>設定</button>
        </div>
        {images.length > 0 && (
          <div>
            <button onClick={handleConvert} disabled={isConverting}>
              {isConverting ? '変換中...' : 'スライドショーに変換'}
            </button>
          </div>
        )}
        {capturedImages.length > 0 && (
          <div>
            <button onClick={handleDownload}>スライドショーをダウンロード</button>
          </div>
        )}
        <Swiper
          ref={swiperRef}
          grabCursor={true}
          modules={[Navigation, Pagination, Scrollbar, A11y, Autoplay, EffectFade]}
          slidesPerView={1}
          spaceBetween={30}
          navigation={true}
          loop={true}
          pagination={{ clickable: true }}
          autoplay={autoplay ? { delay: speed } : false}
          speed={speed}
          effect='fade'
          fadeEffect={{
            crossFade: true
          }}
        >
          {images.map((image, index) => (
            <SwiperSlide key={index}>
              <img src={URL.createObjectURL(image.file)} alt="" style={{ width: '100%' }} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default App;
