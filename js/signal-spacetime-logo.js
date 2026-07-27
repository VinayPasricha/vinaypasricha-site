const mount = document.querySelector("#logo3d");

if (mount) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const weakDevice =
    typeof navigator.hardwareConcurrency === "number" &&
    navigator.hardwareConcurrency <= 2;

  const webGLAvailable = () => {
    try {
      const canvas = document.createElement("canvas");
      const context =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      return Boolean(context);
    } catch {
      return false;
    }
  };

  if (!reducedMotion.matches && !weakDevice) {
    let idleReady = false;
    let inViewport = false;
    let initialized = false;
    let startScene = null;

    const tryInitialize = () => {
      if (!initialized && idleReady && inViewport) {
        initialized = true;
        startScene?.();
      }
    };

    const idle = window.requestIdleCallback
      ? (callback) => window.requestIdleCallback(callback, { timeout: 1000 })
      : (callback) => window.setTimeout(callback, 200);

    idle(() => {
      idleReady = true;
      tryInitialize();
    });

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting;
        tryInitialize();
      },
      { threshold: 0 }
    );
    visibilityObserver.observe(mount);

    startScene = async () => {
      try {
        if (!webGLAvailable()) return;

        const THREE = await import(
          "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js"
        );

        if (reducedMotion.matches) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });

        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.domElement.className = "hero-logo-canvas";
        renderer.domElement.setAttribute("aria-hidden", "true");
        mount.setAttribute("role", "img");
        mount.setAttribute(
          "aria-label",
          "Signal × Spacetime — the mark of Vinay Pasricha"
        );
        mount.append(renderer.domElement);

        const group = new THREE.Group();
        group.rotation.x = 0.3;
        scene.add(group);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x66666f, 0.6));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(4, 6, 5);
        scene.add(keyLight);

        const target = new THREE.Vector3(0, 0.9, 0);
        const cameraDirection = new THREE.Vector3(1, 0.55, 1.25).normalize();
        camera.position.copy(cameraDirection.multiplyScalar(5.6).add(target));
        camera.lookAt(target);

        const palette = [
          ["#e11431", "#ff2038"],
          ["#b3123f", "#d41438"],
          ["#d922a8", "#e824b4"],
          ["#7a2bd4", "#8a2be2"],
          ["#2447e0", "#2e5bff"],
          ["#2e8eff", "#3d9bff"],
        ];

        const signalMaterials = palette.map(
          ([color, emissive]) =>
            new THREE.MeshStandardMaterial({
              color,
              emissive,
              emissiveIntensity: 0.7,
              metalness: 0.35,
              roughness: 0.24,
            })
        );
        const hotMaterial = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          emissive: "#eef2ff",
          emissiveIntensity: 0.9,
          metalness: 0.35,
          roughness: 0.24,
        });

        const wheel = new THREE.Group();
        const barGeometry = new THREE.BoxGeometry(0.05, 1, 0.05);
        const bars = [];

        for (let i = 0; i < 60; i += 1) {
          const angle = (i / 60) * Math.PI * 2;
          const hot = i % 10 === 0;
          const materialIndex = Math.floor((i / 60) * 6);
          const bar = new THREE.Mesh(
            barGeometry,
            hot ? hotMaterial : signalMaterials[materialIndex]
          );

          bar.position.set(
            Math.cos(angle) * 1.3,
            1,
            Math.sin(angle) * 1.3
          );
          bar.rotation.y = -angle;
          bar.userData = { hot, ph: i * 0.42 };
          wheel.add(bar);
          bars.push(bar);
        }

        const chromeRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.3, 0.008, 8, 160),
          new THREE.MeshStandardMaterial({
            color: "#d8dde8",
            metalness: 0.9,
            roughness: 0.15,
          })
        );
        chromeRing.position.y = 1;
        chromeRing.rotation.x = Math.PI / 2;
        wheel.add(chromeRing);
        group.add(wheel);

        const well = (r) => 1 - 1.1 / (1 + (r * 1.15) ** 2);
        const amberBase = {
          color: "#7a4c0e",
          emissive: "#ffa726",
          metalness: 0.55,
          roughness: 0.35,
        };
        const grid = new THREE.Group();
        const ringRadii = [0.55, 0.8, 1.08, 1.4, 1.75, 2.1];
        const gridRingMaterials = [];

        ringRadii.forEach((radius, index) => {
          const material = new THREE.MeshStandardMaterial({
            ...amberBase,
            emissiveIntensity: 0.45,
          });
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(
              radius,
              index < 2 ? 0.008 : 0.006,
              6,
              144
            ),
            material
          );
          ring.position.y = well(radius);
          ring.rotation.x = Math.PI / 2;
          grid.add(ring);
          gridRingMaterials.push(material);
        });

        const spokeMaterial = new THREE.MeshStandardMaterial({
          ...amberBase,
          emissiveIntensity: 0.5,
        });
        const spokeAngles = [];

        class WellSpokeCurve extends THREE.Curve {
          constructor(angle) {
            super();
            this.angle = angle;
          }

          getPoint(u, point = new THREE.Vector3()) {
            const radius = THREE.MathUtils.lerp(0.52, 2.1, u);
            return point.set(
              Math.cos(this.angle) * radius,
              well(radius),
              Math.sin(this.angle) * radius
            );
          }
        }

        for (let i = 0; i < 16; i += 1) {
          const angle = (i / 16) * Math.PI * 2;
          spokeAngles.push(angle);
          grid.add(
            new THREE.Mesh(
              new THREE.TubeGeometry(
                new WellSpokeCurve(angle),
                48,
                0.0055,
                5,
                false
              ),
              spokeMaterial
            )
          );
        }

        const sparkMaterial = new THREE.MeshStandardMaterial({
          color: "#ffc04d",
          emissive: "#ffb347",
          emissiveIntensity: 1.45,
        });
        const sparkGeometry = new THREE.SphereGeometry(0.018, 10, 8);
        const sparks = [];

        spokeAngles.forEach((angle, i) => {
          [i / 16, i / 16 + 0.5].forEach((phase) => {
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            grid.add(spark);
            sparks.push({ mesh: spark, angle, phase });
          });
        });

        group.add(grid);

        const setSparkPosition = (spark, u) => {
          const radius = THREE.MathUtils.lerp(0.52, 2.1, u);
          spark.mesh.position.set(
            Math.cos(spark.angle) * radius,
            well(radius),
            Math.sin(spark.angle) * radius
          );
        };

        const startedAt = performance.now();
        const renderFrame = (now) => {
          const t = (now - startedAt) / 1000;

          bars.forEach((bar) => {
            const { hot, ph } = bar.userData;
            bar.scale.y =
              0.14 +
              (hot ? 0.5 : 0.34) *
                Math.pow(0.5 + 0.5 * Math.sin(ph + t * 1.5), 1.6) +
              0.07 * Math.sin(ph * 2.3 - t * 0.9);
          });

          signalMaterials.forEach((material, k) => {
            material.emissiveIntensity =
              0.5 +
              0.4 * (0.5 + 0.5 * Math.sin(t * 1.5 + k * 1.05));
          });
          hotMaterial.emissiveIntensity =
            0.7 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2));

          gridRingMaterials.forEach((material, k) => {
            material.emissiveIntensity =
              0.35 +
              0.8 *
                Math.pow(
                  0.5 + 0.5 * Math.sin(t * 1.6 - k * 0.85),
                  2.2
                );
          });
          spokeMaterial.emissiveIntensity =
            0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.6));
          sparkMaterial.emissiveIntensity =
            1.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3.2));

          sparks.forEach((spark) => {
            setSparkPosition(spark, (t * 0.14 + spark.phase) % 1);
          });

          wheel.rotation.y = -t * 0.05;
          grid.rotation.y = t * 0.04;
          renderer.render(scene, camera);
        };

        const shouldAnimate = () =>
          inViewport && !document.hidden && !reducedMotion.matches;
        const syncAnimation = () => {
          renderer.setAnimationLoop(shouldAnimate() ? renderFrame : null);
        };

        const resize = () => {
          const { width, height } = mount.getBoundingClientRect();
          if (!width || !height) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();

        renderFrame(performance.now());
        const fallback = mount.querySelector("img");
        if (fallback) {
          requestAnimationFrame(() => {
            fallback.style.opacity = "0";
            fallback.addEventListener(
              "transitionend",
              () => fallback.remove(),
              { once: true }
            );
            window.setTimeout(() => fallback.remove(), 350);
          });
        }

        const handleVisibility = () => syncAnimation();
        document.addEventListener("visibilitychange", handleVisibility);

        visibilityObserver.disconnect();
        const animationObserver = new IntersectionObserver(
          ([entry]) => {
            inViewport = entry.isIntersecting;
            syncAnimation();
          },
          { threshold: 0 }
        );
        animationObserver.observe(mount);
        syncAnimation();

        const restoreFallback = () => {
          renderer.setAnimationLoop(null);
          if (!mount.querySelector("img")) {
            const fallbackImage = document.createElement("img");
            fallbackImage.src =
              "/assets/images/vinay-signal-spacetime-mark.png";
            fallbackImage.alt =
              "Signal × Spacetime — the mark of Vinay Pasricha";
            mount.prepend(fallbackImage);
          }
          renderer.domElement.remove();
        };

        reducedMotion.addEventListener(
          "change",
          () => {
            if (reducedMotion.matches) restoreFallback();
          },
          { once: true }
        );

        window.addEventListener(
          "pagehide",
          () => {
            renderer.setAnimationLoop(null);
            resizeObserver.disconnect();
            animationObserver.disconnect();
            document.removeEventListener(
              "visibilitychange",
              handleVisibility
            );
            renderer.dispose();
          },
          { once: true }
        );
      } catch (error) {
        console.warn("Signal × Spacetime could not start.", error);
      }
    };
  }
}
