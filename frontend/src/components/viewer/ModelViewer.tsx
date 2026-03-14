import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { ModelLoader } from "./ModelLoader";

interface ModelViewerProps {
  url: string;
  style?: React.CSSProperties;
}

export function ModelViewer({ url, style }: ModelViewerProps) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: 400, ...style }}>
      <Canvas camera={{ position: [2, 1.5, 2], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-3, 2, -3]} intensity={0.5} />
        <Suspense fallback={<LoadingBox />}>
          <Center>
            <ModelLoader url={url} />
          </Center>
        </Suspense>
        <Grid
          infiniteGrid
          fadeDistance={10}
          fadeStrength={2}
          cellSize={0.5}
          sectionSize={2}
          cellColor="#888"
          sectionColor="#444"
        />
        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

function LoadingBox() {
  const ref = useRef<THREE.Mesh>(null!);
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  );
}
