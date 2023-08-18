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
  const [autoplayDelay, setAutoplayDelay] = useState(3);
  const [speed, setSpeed] = useState(1000);


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

  const captureSlide = async (slide) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = slide.offsetWidth;
    canvas.height = slide.offsetHeight;

    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, slide.offsetWidth, slide.offsetHeight);
        resolve(canvas.toDataURL('image/jpeg', 1.0));
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

    return capturedSlides;
  };

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

  const handleDownload = async () => {
    setIsConverting(true);
  
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

      const changeTime = speed / 1000;
      

      let filterComplex = '';

      
      for (let i = 0; i < numImages; i++) {
        filterComplex += `[${i}]settb=AVTB[v${i}];`;
      }
      

      let xfadeFilters = '';

      for (let i = 0; i < numImages - 1; i ++) {
        const offsetTime = autoplayDelay * (i + 1) - changeTime * (i + 1);
        // 画像数 > 3かつ偶数の場合
        if(images.length > 3) {
          if (i === 0) {   
            xfadeFilters += `[v${i}][v${i + 1}]xfade=transition=fade:duration=${changeTime}:offset=${offsetTime}[v${i}${i + 1}];`
          }
          else {
            xfadeFilters += `[v${i - 1}${i}][v${i + 1}]xfade=transition=fade:duration=${changeTime}:offset=${offsetTime}[v${i}${i + 1}];`
          }
        }
      // 画像が3枚の場合 
      else if (images.length === 3) {
        xfadeFilters += `[v${i}][v${i + 1}]xfade=transition=fade:duration=${changeTime}:offset=${offsetTime}[v01];[v01][v2]xfade=transition=fade:duration=${changeTime}:offset=${offsetTime};`;
      }
      // 画像が2枚の場合
      else if (images.length === 2) {
        xfadeFilters += `[v${i}][v${i + 1}]xfade=transition=fade:duration=${changeTime}:offset=${offsetTime},`;
      }
    }
    
    
    if (xfadeFilters.endsWith(';')) {
      xfadeFilters = xfadeFilters.slice(0, -1)/* + ','*/;
    }
    

    filterComplex += xfadeFilters;
    /*filterComplex += `scale=trunc(iw/2)*2:trunc(ih/2)*2[v]`;*/

  
    let imageInputs = [];
    for (let i = 0; i < numImages; i++) {
      imageInputs.push('-loop', '1', '-t', `${autoplayDelay}`, '-i', `input_${i}.jpg`);
    }
    if (numImages > 3) {
      await ffmpeg.run(
        ...imageInputs,
        '-filter_complex', filterComplex,
        '-map', `[v${images.length - 2}${images.length - 1}]`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-s', '1340x670',
        'output.mp4'
      );
    }
    else {
      await ffmpeg.run(
        ...imageInputs,
        '-filter_complex', filterComplex,
        '-map', '[v]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-s', '1340x670',
        'output.mp4'
      );
    }
/*
if (images.length % 2 === 1){
      xfadeFilters += `[v][v${i + 1}]xfade=transition=fade:duration=${speed / 1000}:offset=${autoplayDelay - (speed / 1000)}[v${i}${i + 1}],`;
    }
    else(images.length % 2 === 0) {
      xfadeFilters += `[v01][v${images.length - 2}${images.length  - 1}]xfade=transition=fade:duration=${speed / 1000}:offset=${autoplayDelay - (speed / 1000)}[v${i}${i + 1}],`;
    }
*/

      const outputData = ffmpeg.FS('readFile', 'output.mp4');
      const url = URL.createObjectURL(new Blob([outputData.buffer], { type: 'video/mp4' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'slideshow.mp4');
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
  
      setIsConverting(false);
    } catch (error) {
      console.error(error);
      setIsConverting(false);
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
