import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Battery,
  Camera,
  CircleStop,
  Gauge,
  Map,
  Pause,
  Radio,
  Route,
  Settings2,
  ShieldCheck,
  Upload,
  User,
  Wifi,
} from "lucide-react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, PCDLoader } from "three-stdlib";

const DEFAULT_PCD = "/sample.pcd";
const DEFAULT_VIDEO = "/sample.mp4";

const navItems = [
  { label: "Map", icon: Map },
  { label: "Camera", icon: Camera },
  { label: "Missions", icon: Route },
  { label: "Radio", icon: Radio },
  { label: "Settings", icon: Settings2 },
];

const Pill = ({ children, tone = "ok" }) => {
  const toneClass = {
    ok: "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/30",
    warn: "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/30",
    danger: "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/30",
    idle: "bg-sky-500/10 text-sky-200 ring-1 ring-sky-400/30",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
};

const TopBadge = ({ icon: Icon, label, tone = "ok" }) => (
  <Pill tone={tone}>
    <Icon className="h-3.5 w-3.5" />
    {label}
  </Pill>
);

function usePCD(source) {
  const [points, setPoints] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!source) return undefined;

    let active = true;
    let objectUrl;
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    if (typeof source !== "string") objectUrl = url;

    const loader = new PCDLoader();
    loader.load(
      url,
      (loadedPoints) => {
        if (!active) return;
        loadedPoints.geometry.center();
        loadedPoints.geometry.computeBoundingSphere();
        loadedPoints.material.size = 1.15;
        loadedPoints.material.color = new THREE.Color("#67e8f9");
        setPoints(loadedPoints);
        setError("");
      },
      undefined,
      () => {
        if (active) setError("Unable to load point cloud");
      },
    );

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return { points, error };
}

const ThreeScene = ({ file, onDropped }) => {
  const { points, error } = usePCD(file);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const stop = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const onDrop = (event) => {
      stop(event);
      const nextFile = event.dataTransfer.files?.[0];
      if (nextFile?.name.toLowerCase().endsWith(".pcd")) onDropped(nextFile);
    };

    ["dragenter", "dragover", "dragleave"].forEach((eventName) => el.addEventListener(eventName, stop));
    el.addEventListener("drop", onDrop);

    return () => {
      ["dragenter", "dragover", "dragleave"].forEach((eventName) => el.removeEventListener(eventName, stop));
      el.removeEventListener("drop", onDrop);
    };
  }, [onDropped]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-[420px] overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl shadow-slate-950/30 lg:min-h-0 lg:h-full"
    >
      <Canvas camera={{ position: [6, 8, 10], fov: 58 }}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[5, 10, 4]} intensity={1} />
        {points ? <primitive object={points} /> : <GridFloor />}
        <RobotMarker />
        <SceneControls />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
        <Pill tone={points ? "ok" : "warn"}>{points ? "Point cloud active" : "Loading map"}</Pill>
        {error && <Pill tone="danger">{error}</Pill>}
      </div>
    </div>
  );
};

function GridFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100, 100, 18, 18]} />
      <meshBasicMaterial wireframe color="#38bdf8" transparent opacity={0.55} />
    </mesh>
  );
}

function RobotMarker() {
  const group = useRef(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.position.x = Math.sin(t * 0.35) * 2;
    group.current.position.z = Math.cos(t * 0.35) * 2;
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.1, 32]} />
        <meshStandardMaterial color="#22d3ee" />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <coneGeometry args={[0.16, 0.36, 24]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}

function SceneControls() {
  const { camera, gl } = useThree();
  const controls = useMemo(() => {
    const instance = new OrbitControls(camera, gl.domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.08;
    return instance;
  }, [camera, gl]);

  useFrame(() => controls.update());
  useEffect(() => () => controls.dispose(), [controls]);

  return null;
}

function CameraPanel({ srcObject, onPickFile }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (srcObject instanceof Blob) {
      const url = URL.createObjectURL(srcObject);
      video.src = url;
      return () => URL.revokeObjectURL(url);
    }

    video.src = DEFAULT_VIDEO;
    return undefined;
  }, [srcObject]);

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
      <video ref={videoRef} className="h-full w-full object-cover" autoPlay loop muted playsInline controls />
      <div className="absolute left-4 top-4">
        <Pill tone="idle">Camera feed</Pill>
      </div>
      <label className="absolute bottom-4 left-4 inline-flex cursor-pointer items-center gap-2 rounded-md border border-sky-400/40 bg-slate-950/80 px-3 py-2 text-xs font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/20">
        <Upload className="h-4 w-4" />
        Load video
        <input type="file" accept="video/*" className="hidden" onChange={(event) => onPickFile(event.target.files?.[0] || null)} />
      </label>
    </div>
  );
}

const JoystickWidget = () => (
  <div className="grid h-36 w-36 place-items-center rounded-full border border-slate-600 bg-slate-950">
    <div className="relative h-24 w-24 rounded-full border border-sky-400/50">
      <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400 shadow-lg shadow-sky-500/30" />
    </div>
  </div>
);

const StopWidget = () => (
  <button
    className="grid h-28 w-28 place-items-center rounded-full bg-rose-600 text-rose-50 shadow-xl shadow-rose-950/30 transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-300"
    type="button"
    aria-label="Emergency stop"
  >
    <CircleStop className="h-11 w-11" />
  </button>
);

const Panel = ({ title, icon: Icon, children }) => (
  <section className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/20">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {Icon && <Icon className="h-4 w-4 text-sky-300" />}
    </div>
    {children}
  </section>
);

export default function App() {
  const [activeTab, setActiveTab] = useState("map");
  const [pcdFile, setPcdFile] = useState(DEFAULT_PCD);
  const [videoBlob, setVideoBlob] = useState(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 grid-rows-[auto_auto_1fr] lg:grid-cols-[76px_1fr] lg:grid-rows-[auto_1fr]">
        <aside className="order-2 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 lg:order-none lg:row-span-2 lg:flex-col lg:border-b-0 lg:border-r lg:px-0 lg:py-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky-500 text-xs font-black tracking-wide text-slate-950">
            ERIC
          </div>
          <nav className="flex flex-1 items-center gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-900 hover:text-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                type="button"
                title={label}
                aria-label={label}
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </nav>
          <button className="grid h-10 w-10 place-items-center rounded-md text-slate-400 transition hover:bg-slate-900 hover:text-sky-200" type="button" aria-label="Account">
            <User className="h-5 w-5" />
          </button>
        </aside>

        <header className="order-1 border-b border-slate-800 bg-slate-950 px-4 py-4 lg:order-none">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="idle">
                Status <span className="font-semibold text-sky-100">Mission 1234</span>
              </Pill>
              <button className="grid h-8 w-8 place-items-center rounded-md bg-slate-900 text-sky-200 transition hover:bg-slate-800" type="button" aria-label="Pause mission">
                <Pause className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-wrap items-center gap-2">
              <TopBadge icon={Battery} label="100%" />
              <TopBadge icon={Wifi} label="Strong" />
              <TopBadge icon={ShieldCheck} label="Failsafe okay" />
              <TopBadge icon={ShieldCheck} label="System okay" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-sky-400 hover:text-sky-100" type="button">
                Quick goal
              </button>
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-700">
                <button className={`px-3 py-2 text-xs font-medium ${activeTab === "map" ? "bg-sky-500 text-slate-950" : "text-slate-300"}`} type="button" onClick={() => setActiveTab("map")}>
                  Map View
                </button>
                <button className={`px-3 py-2 text-xs font-medium ${activeTab === "cam" ? "bg-sky-500 text-slate-950" : "text-slate-300"}`} type="button" onClick={() => setActiveTab("cam")}>
                  Camera View
                </button>
              </div>
              <button className="rounded-md bg-rose-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-rose-500" type="button">
                Initiate
              </button>
            </div>
          </div>
        </header>

        <main className="order-3 p-4 lg:order-none">
          <div className="grid gap-4 lg:h-[calc(100vh-105px)] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="relative min-h-[480px]">
              {activeTab === "map" ? (
                <div className="flex h-full flex-col gap-3">
                  <ThreeScene file={pcdFile} onDropped={setPcdFile} />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400">
                      <Upload className="h-4 w-4" />
                      Load .pcd
                      <input type="file" accept=".pcd" className="hidden" onChange={(event) => setPcdFile(event.target.files?.[0] || DEFAULT_PCD)} />
                    </label>
                    <span className="text-xs text-slate-400">Drag a point-cloud file onto the map to replace the sample.</span>
                  </div>

                  <motion.div
                    className="absolute bottom-16 left-4 hidden w-64 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl shadow-slate-950/40 sm:block"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <video className="h-36 w-full object-cover opacity-90" src={DEFAULT_VIDEO} autoPlay loop muted playsInline />
                    <div className="absolute bottom-2 right-2 rounded bg-slate-950/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-sky-100">
                      Camera
                    </div>
                  </motion.div>
                </div>
              ) : (
                <CameraPanel srcObject={videoBlob} onPickFile={setVideoBlob} />
              )}
            </section>

            <aside className="grid gap-4 md:grid-cols-3 lg:flex lg:flex-col">
              <Panel title="Emergency">
                <div className="flex justify-center">
                  <StopWidget />
                </div>
              </Panel>

              <Panel title="Teleop" icon={Gauge}>
                <div className="flex justify-center">
                  <JoystickWidget />
                </div>
              </Panel>

              <Panel title="Session">
                <dl className="space-y-2 text-sm">
                  {[
                    ["Robot", "ERIC-01"],
                    ["Map", "Factory Floor A"],
                    ["Operator", "Guest"],
                    ["Mode", "Autonomous"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="font-medium text-slate-100">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
