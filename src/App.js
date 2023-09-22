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

const ffmpeg = createFFmpeg();

const App = () => {
  const [images, setImages] = useState([]);
  const [, setCapturedImages] = useState([]);
  const [, setIsConverting] = useState(false);
  const [downloadButtonDisabled, setDownloadButtonDisabled] = useState(false);
  const swiperRef = useRef(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [autoplayDelay, setAutoplayDelay] = useState(3);
  const [speed, setSpeed] = useState(1000);
  const [showKome, setShowKome] = useState(false);
  const [showDLbutton, setShowDLbutton] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");


  const handleDrop = async (acceptedFiles) => {
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

  const toggleAutoplay = () => {
    setAutoplay((prevAutoplay) => !prevAutoplay);
  };
  const handleAutoplayDelayChange = (event) => {
    const newDelay = parseInt(event.target.value);
    setAutoplayDelay(newDelay >= 0 ? newDelay : 0);
  };
  const handleSpeedChange = (event) => {
    const newSpeed = parseInt(event.target.value);
    setSpeed(newSpeed >= 0 ? newSpeed : 0);
  };

  const handleApplySettings = () => {
    if (swiperRef.current) {
      const swiper = swiperRef.current.swiper;
      swiper.params.autoplay = autoplay ? { delay: autoplayDelay * 1000 } : false;
      swiper.params.speed = speed >= 0 ? speed : 0;

      swiper.update();
      swiper.autoplay.start();
      setShowKome(true);
      setShowDLbutton(true);
      console.log("Autoplay setting:", swiper.params.autoplay);
      }
  };

  const captureSlide = async (slide) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = slide.offsetWidth;
    canvas.height = slide.offsetHeight;
  
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, slide.offsetWidth, slide.offsetHeight);
        // 画像をData URL形式で取得
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      image.src = slide.children[0].src;
    });
  };
  

  const captureSlides = async () => {
    const swiper = swiperRef.current.swiper;
    const slideElements = swiper.el.children[0].querySelectorAll('.swiper-slide');
  
    const capturedSlides = [];
  
    for (const slide of slideElements) {
      const capturedSlide = await captureSlide(slide);
      capturedSlides.push(capturedSlide);
    }
  
    console.log('capturedSlides:', capturedSlides); // デバッグ用にログ出力
  
    return capturedSlides;
  };
  

  const handleDownload = async () => {
    if (downloadButtonDisabled) {
      // ダウンロード中またはボタンが無効ならば何もしない
      return;
    }
    setIsConverting(true); // 変換中のフラグを立てる
    setErrorMessage('');
    setDownloadButtonDisabled(true); // ダウンロードボタンを無効化
  
    try {
      const capturedSlides = await captureSlides();
      setCapturedImages(capturedSlides);
  
      await ffmpeg.load();
      ffmpeg.setProgress(({ ratio }) => {
        console.log(`Conversion progress: ${Math.round(ratio * 100)}%`);
      });
  
      const numImages = capturedSlides.length;
  
      for (let i = 0; i < numImages; i++) {
        const slide = capturedSlides[i];
        const imageData = await fetchFile(slide);
        ffmpeg.FS('writeFile', `input_${i}.jpg`, imageData);
      }
  
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
        xfadeFilters = xfadeFilters.slice(0, -1);
      }
  
      filterComplex += xfadeFilters;
  
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
      
  
      const outputData = ffmpeg.FS('readFile', 'output.mp4');
      const blob = new Blob([outputData.buffer], { type: 'video/mp4' });
  
      // BlobオブジェクトからURLを生成
      const url = URL.createObjectURL(blob);
      const timestamp = Date.now(); // 現在のタイムスタンプを取得
      const fileName = `slideshow_${timestamp}.mp4`; // ユニークなファイル名を生成
  
      // ダウンロード用のリンクを動的に生成
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
  
      // リンクをDOMに追加してクリックイベントを発生させる
      document.body.appendChild(a);
      a.click();
  
      // リンクを削除してURLを解放
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.alert('ダウンロードが完了しました！');
    } catch (error) {
      console.error(error);
      setDownloadButtonDisabled(false);
      setErrorMessage(`ダウンロードエラー：${error.message || error}`);
    } finally {
      setIsConverting(false); // 変換完了後に変換中のフラグを解除
      setDownloadButtonDisabled(true);
    }
  };
  
  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    handleResize(); 

    window.addEventListener('resize', handleResize); 

    return () => {
      window.removeEventListener('resize', handleResize); 
    };
  }, []);

  return (
    <section id="testimonials">
      <div className="container" style={{ height: `${viewportHeight}px` }}>
        <div className="App">
          <h1>SLIDE</h1>
          <Dropzone onDrop={handleDrop}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                style={{ width: '100%', height: '100px', border: '1px dashed black'}}
                className="dropzone"
              >
                <input {...getInputProps()} />
                <p>クリックして画像をドロップ</p>
              </div>
            )}
          </Dropzone>
          <div className="settings">
            <div>
            <p className="error-message">{errorMessage}</p>
              <label>
                画像表示時間 :
                <input type="text" value={autoplayDelay} onChange={handleAutoplayDelayChange} />
                秒         
              </label>
            </div>
            <div>
              <label>
                スライド時間 :
                <input type="text" value={speed} onChange={handleSpeedChange} />
                ミリ秒
              </label>
            </div>
            <div>
              <label>
                <input type="checkbox" checked={autoplay} onChange={toggleAutoplay} />
                自動再生
              </label>
            </div>
            <div className='button-flex'>
            <div className='prev'>
              <button onClick={handleApplySettings}>プレビュー</button>
              {showKome && <p className='kome'>※画像をスワイプすると動作が確認できます</p>}
            </div>
          </div>
          {showDLbutton && (
            <div>
              <button onClick={handleDownload} disabled={downloadButtonDisabled}>
                {downloadButtonDisabled ? "ダウンロード中..." : "ダウンロード"}
              </button>
            </div>
          )}
          </div>
        </div>
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
          onSwiper={(swiper) => {
            if (swiper) {
              swiper.slideTo(0); // スライドを最初のスライドに移動
            }
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
