import React, { useState, useRef } from 'react';
import { Navigation, Pagination, Scrollbar, A11y, Autoplay } from 'swiper';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';
import Dropzone from 'react-dropzone';
import Compressor from 'compressorjs';
import './App.css';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';

const App = () => {
  const [images, setImages] = useState([]);
  const swiperRef = useRef(null);
  const [autoplay, setAutoplay] = useState(true);
  const [speed, setSpeed] = useState(1000);
  const [animation, setAnimation] = useState(true);
  const [autoplayDelay, setAutoplayDelay] = useState(3); // デフォルトは3秒

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

    setImages((prevImages) => [...prevImages, ...compressedImages]);
  };

  const toggleAutoplay = () => {
    setAutoplay((prevAutoplay) => !prevAutoplay);
  };

  const handleSpeedChange = (event) => {
    const newSpeed = parseInt(event.target.value);
    setSpeed(newSpeed);
  };

  const toggleAnimation = () => {
    setAnimation((prevAnimation) => !prevAnimation);
  };
  const handleAutoplayDelayChange = (event) => {
    const newDelay = parseInt(event.target.value);
    setAutoplayDelay(newDelay);
  };

  const handleApplySettings = () => {
    if (swiperRef.current) {
      swiperRef.current.swiper.autoplay.stop();
      swiperRef.current.swiper.params.autoplay = autoplay ? { delay: autoplayDelay * 1000 } : false;
      swiperRef.current.swiper.params.speed = speed;
      swiperRef.current.swiper.params.observer = animation;
      swiperRef.current.swiper.update();
      swiperRef.current.swiper.autoplay.start();
    }
  };

  return (
    <section id="testimonials">
      <div className="container">
        <h1>App</h1>
        <Dropzone onDrop={handleDrop}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()} style={{ width: '80%', height: '100px', border: '1px dashed black', marginLeft:`10%` }} className="dropzone">
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
              <input type="number" value={autoplayDelay} onChange={handleAutoplayDelayChange} />
  </label>
</div>
          <div>
            <label>
              Speed:
              <input type="number" value={speed} onChange={handleSpeedChange} />
              ms
            </label>
          </div>

          <div>
            <label>
              <input type="checkbox" checked={animation} onChange={toggleAnimation} />
              Animation
            </label>
          </div>
          <button onClick={handleApplySettings}>設定</button>
        </div>

        <Swiper
          ref={swiperRef}
          modules={[Navigation, Pagination, Scrollbar, A11y, Autoplay]}
          slidesPerView={1}
          spaceBetween={30}
          navigation={true}
          loop={true}
          pagination={{ clickable: true }}
          autoplay={autoplay ? { delay: speed } : false}
          speed={speed}
          observer={animation}
        >
          {images.map((image, index) => (
            <SwiperSlide key={index}>
              <img src={URL.createObjectURL(image)} alt={``} style={{ width: '100%' }} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default App;



/*
import React, { useState } from 'react';
import { Navigation, Pagination, Scrollbar, A11y, Autoplay} from 'swiper';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';
import Dropzone from 'react-dropzone';
import Compressor from 'compressorjs';
import './App.css';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';


const App = () => {
  const [images, setImages] = useState([]);

  const handleDrop = async (acceptedFiles) => {
    const compressedImages = [];

    for (const file of acceptedFiles) {
      const compressedImage = await new Promise((resolve) => {
        new Compressor(file, {
          quality: 1,
          height:300,
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

    setImages((prevImages) => [...prevImages, ...compressedImages]);
  };

  return (
    <section id="testimonials">
      <div className="container">
        <h1>App</h1>
        <Dropzone onDrop={handleDrop}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()} style={{ width: '100%', height: '200px', border: '1px dashed black' }} className="dropzone">
              <input {...getInputProps()} />
              <p>クリックして画像をドラッグ＆ドロップしてアップロード</p>
            </div>
          )}
        </Dropzone>

        <Swiper
          modules={[Navigation, Pagination, Scrollbar, A11y, Autoplay]}
          slidesPerView={1}
          spaceBetween={30}
          navigation={true}
          loop={true}
          pagination={{ clickable: true }}
          autoplay={{ delay: 1000 }}
        >
          {images.map((image, index) => (
            <SwiperSlide key={index}>
              <img src={URL.createObjectURL(image)} alt={``} style={{ width: '100%', height:`300` }}/>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default App;
*/

/*
import React, { useState } from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import Dropzone from 'react-dropzone';
import Compressor from 'compressorjs';

const App = () => {
  const [images, setImages] = useState([]);

  const handleDrop = async (acceptedFiles) => {
    const compressedImages = [];

    for (const file of acceptedFiles) {
      const compressedImage = await new Promise((resolve) => {
        new Compressor(file, {
          quality: 1,
          height: 180,
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

    setImages(compressedImages);
  };

  const settings = {
    dots: true,
    infinite: true,
    speed: 300,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    arrows: true,
  };

  return (
    <div>
      <h1>Slideshow App</h1>
      <Dropzone onDrop={handleDrop}>
        {({ getRootProps, getInputProps }) => (
          <div {...getRootProps()} style={{ width: '300px', height: '200px', border: '1px dashed black' }}>
            <input {...getInputProps()} />
            <p>ドラッグ＆ドロップで画像をアップロード</p>
          </div>
        )}
      </Dropzone>
     
      <Slider {...settings}>
        {images.map((image, index) => (
          <div key={index}>
            <img src={URL.createObjectURL(image)} alt={`Slideshow ${index}`} />
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default App;
*/