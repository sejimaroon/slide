import React, { useState, useRef, useEffect } from "react";
import {
  Navigation,
  Pagination,
  Scrollbar,
  A11y,
  Autoplay,
  EffectFade,
} from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "./App.css";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/scrollbar";
import "swiper/css/effect-fade";

import Dropzone from "react-dropzone";
import Compressor from "compressorjs";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import axios from "axios";

const ffmpeg = createFFmpeg();

const App = () => {
  const [images, setImages] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const swiperRef = useRef(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [autoplayDelay, setAutoplayDelay] = useState(3);
  const [speed, setSpeed] = useState(1000);

  const [trans, setTrans] = useState();

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
  const selectTransChange = (event) => {
    const newTrans = event.target.value;
    setTrans(newTrans);
  };
  const handleApplySettings = () => {
    if (swiperRef.current) {
      const swiper = swiperRef.current.swiper;
      swiper.params.autoplay = autoplay
        ? { delay: autoplayDelay * 1000 }
        : false;
      swiper.params.speed = speed >= 0 ? speed : 0;
      swiper.params.transition = trans;
      swiper.params.effect = trans;
      swiper.update();

      const requestBody = {
        autoPlayDelay: autoplayDelay,
        speed: speed,
        trans: trans,
      };

      axios
        .post("/slide/updateSettings", requestBody)
        .then((response) => {
          console.log(response.data);
          swiper.autoplay.start();
        })
        .catch((error) => {
          console.error(error);
        });
    }
  };

  const captureSlide = async (slide) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = slide.offsetWidth;
    canvas.height = slide.offsetHeight;

    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, slide.offsetWidth, slide.offsetHeight);
        resolve(canvas.toDataURL("image/jpeg", 1.0));
      };
      image.src = slide.children[0].src;
    });
  };

  const captureSlides = async () => {
    const swiper = swiperRef.current.swiper;
    const slideElements =
      swiper.el.children[0].querySelectorAll(".swiper-slide");

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
    setIsDownloading(true);

    try {
      const capturedSlides = await captureSlides();
      setCapturedImages(capturedSlides);

      await ffmpeg.load();

      const numImages = capturedSlides.length;

      for (let i = 0; i < numImages; i++) {
        const slide = capturedSlides[i];
        const imageData = await fetchFile(slide);
        ffmpeg.FS("writeFile", `input_${i}.jpg`, imageData);
      }

      let filterComplex = "";
      for (let i = 0; i < numImages; i++) {
        filterComplex += `[${i}]settb=AVTB[v${i}];`;
      }

      let xfadeFilters = "";

      for (let i = 0; i < numImages - 1; i++) {
        const changeTime = speed / 2000;
        const offsetTime = autoplayDelay * (i + 1);

        if (i === 0) {
          xfadeFilters += `[v${i}][v${
            i + 1
          }]xfade=transition=${trans}:duration=${changeTime}:offset=${offsetTime}[v${i}${
            i + 1
          }];`;
        } else {
          xfadeFilters += `[v${i - 1}${i}][v${
            i + 1
          }]xfade=transition=${trans}:duration=${changeTime}:offset=${offsetTime}[v${i}${
            i + 1
          }];`;
        }
      }
      if (xfadeFilters.endsWith(";")) {
        xfadeFilters = xfadeFilters.slice(0, -1) /* + ','*/;
      }

      filterComplex += xfadeFilters;
      /*filterComplex += `scale=trunc(iw/2)*2:trunc(ih/2)*2[v]`;*/

      let imageInputs = [];
      for (let i = 0; i < numImages; i++) {
        imageInputs.push(
          "-loop",
          "1",
          "-t",
          `${autoplayDelay + speed / 1000}`,
          "-i",
          `input_${i}.jpg`
        );
      }
      if (numImages > 1) {
        await ffmpeg.run(
          ...imageInputs,
          "-filter_complex",
          filterComplex,
          "-map",
          `[v${images.length - 2}${images.length - 1}]`,
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-s",
          "1340x670",
          "output.mp4"
        );
      } else {
        await ffmpeg.run(
          ...imageInputs,
          "-filter_complex",
          filterComplex,
          "-map",
          "[v]",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-s",
          "1340x670",
          "output.mp4"
        );
      }

      const outputData = ffmpeg.FS("readFile", "output.mp4");
      const url = URL.createObjectURL(
        new Blob([outputData.buffer], { type: "video/mp4" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "slideshow.mp4");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setIsDownloading(false);
    } catch (error) {
      console.error(error);
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <section id="testimonials">
      <div
        className="container"
        style={{ height: `${viewportHeight - 180}px`, color: "#333" }}
      >
        <Swiper
          ref={swiperRef}
          grabCursor={true}
          modules={[
            Navigation,
            Pagination,
            Scrollbar,
            A11y,
            Autoplay,
            EffectFade,
          ]}
          slidesPerView={1}
          spaceBetween={30}
          navigation={true}
          loop={true}
          pagination={{ clickable: true }}
          autoplay={autoplay ? { delay: speed } : false}
          speed={speed}
          effect={trans}
          fadeEffect={{
            crossFade: true,
          }}
        >
          {images.map((image, index) => (
            <SwiperSlide key={index}>
              <div className="image-container">
                <img
                  src={URL.createObjectURL(image.file)}
                  alt=""
                  style={{ width: "100%" }}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
        <div className="setting-menu">
          <Dropzone onDrop={handleDrop}>
            {({ getRootProps, getInputProps }) => (
              <div {...getRootProps()} className="dropzone">
                <input {...getInputProps()} />
                <p>クリックして画像をドロップ</p>
              </div>
            )}
          </Dropzone>
          <div className="settings">
            <div>
              <label>
                自動再生
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={toggleAutoplay}
                  className="toggleplay"
                />
              </label>
            </div>
            <div>
              <label>
                画像表示時間 :
                <input
                  type="text"
                  value={autoplayDelay}
                  className="handleAutoplayDelayChange"
                  onChange={handleAutoplayDelayChange}
                />
                秒
              </label>
            </div>
            <div>
              <label>
                画像切り替わり時間
                <input
                  type="text"
                  value={speed}
                  className="handleSpeedChange"
                  onChange={handleSpeedChange}
                />
                ミリ秒
              </label>
              <div>
                <div>
                  <label>
                    エフェクト:
                    <select value={trans} onChange={selectTransChange}>
                      <option value="slide">slide</option>
                      <option value="fade">fade</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div className="btn-flex">
              <button onClick={handleApplySettings} className="setting-btn">
                設定
              </button>
            </div>
            {images.length > 1 && (
              <div>
                <button
                  onClick={handleConvert}
                  disabled={isConverting}
                  className="convert-btn"
                >
                  {isConverting ? "変換中..." : "スライドショーに変換"}
                </button>
              </div>
            )}
            {capturedImages.length > 0 && (
              <div>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="download-btn"
                >
                  {isDownloading ? "ダウンロード中..." : "ダウンロード"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default App;
