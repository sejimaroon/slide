/*
import React, { useState, useRef } from 'react';
import { Navigation, Pagination, Scrollbar, A11y, Autoplay, EffectFade, EffectCube, EffectCoverflow, EffectFlip } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import './App.css';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';
import 'swiper/css/effect-fade';
import 'swiper/css/effect-cube';
import 'swiper/css/effect-coverflow';
import 'swiper/css/effect-flip';
import Dropzone from 'react-dropzone';
import Compressor from 'compressorjs';
import axios from 'axios';

const App = () => {
  const [images, setImages] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isConverting, setIsConverting] = useState(false);

  const swiperRef = useRef(null);

  const [autoplay, setAutoplay] = useState(true);
  const [speed, setSpeed] = useState(1000);
  const [effect, setEffect] = useState("default");
  const [autoplayDelay, setAutoplayDelay] = useState(2);

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

  const handleSpeedChange = (event) => {
    const newSpeed = parseInt(event.target.value);
    setSpeed(newSpeed >= 0 ? newSpeed : 0);
  };

  const handleAutoplayDelayChange = (event) => {
    const newDelay = parseInt(event.target.value);
    setAutoplayDelay(newDelay >= 0 ? newDelay : 0);
  };

  const handleEffectChange = (event) => {
    const newEffect = event.target.value;
    setEffect(newEffect);
    console.log(newEffect);
    if (swiperRef.current) {
      const swiper = swiperRef.current.swiper;
      swiper.params.effect = newEffect;
      swiper.update();
    }
  };

  const handleApplySettings = () => {
    if (swiperRef.current) {
      const swiper = swiperRef.current.swiper;
      swiper.params.autoplay = autoplay ? { delay: autoplayDelay * 1000 } : false;
      swiper.params.speed = speed >= 0 ? speed : 0;
      swiper.params.effect = effect;
      swiper.update();
      swiper.autoplay.start();
    }
  };
/*
  const handleConvert = async () => {
    setIsConverting(true);

    const captureSlide = (slide) => {
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

    try {
      const capturedSlides = await captureSlides();
      setCapturedImages(capturedSlides);
      setIsConverting(false);
    } catch (error) {
      console.error(error);
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    const requestData = {
      images: capturedImages,
      settings: {
        speed,
        autoplay,
        autoplayDelay,
        effect,
      },
    };

    axios
      .post('/slide/download', requestData, {
        responseType: 'blob',
      })
      .then((response) => {
        const url = URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'slideshow.mp4');
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error('Error generating video:', error);
      });
  };

  return (
    <section id="testimonials">
      <div className="container">
        <h1>App</h1>
        <Dropzone onDrop={handleDrop}>
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              style={{ width: '90%', height: '100px', border: '1px dashed black', marginLeft: `5%` }}
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
          <div>
          <label>
            Animation:
            <select value={effect} onChange={handleEffectChange}>
              <option value="default">default</option>
              <option value="fade">fade</option>
              <option value="cube">cube</option>
              <option value="coverflow">coverflow</option>
              <option value="flip">flip</option>
            </select>
          </label>
          </div>
          <button onClick={handleApplySettings}>設定</button>
        </div>
        
        <Swiper
          ref={swiperRef}
          grabCursor={true}
          modules={[Navigation, Pagination, Scrollbar, A11y, Autoplay, EffectFade, EffectCube, EffectCoverflow, EffectFlip]}
          slidesPerView={1}
          spaceBetween={30}
          navigation={true}
          loop={true}
          pagination={{ clickable: true }}
          autoplay={autoplay ? { delay: speed } : false}
          speed={speed}
          effect={effect} 
          coverflowEffect={{
            rotate: 50,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: true,
          }}
          cubeEffect={{
            shadow: true,
            slideShadows: true,
            shadowOffset: 20,
            shadowScale: 0.94,
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
        */
