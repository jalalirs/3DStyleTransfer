import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

interface ModelLoaderProps {
  url: string;
}

export function ModelLoader({ url }: ModelLoaderProps) {
  const ext = url.split(".").pop()?.toLowerCase().split("?")[0] || "";

  if (ext === "gltf" || ext === "glb") {
    return <GltfModel url={url} />;
  }

  if (ext === "obj") {
    return <ObjModel url={url} />;
  }

  // Fallback: try as glTF
  return <GltfModel url={url} />;
}

function GltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => {
    const s = scene.clone(true);
    // Normalize scale
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      s.scale.multiplyScalar(2 / maxDim);
    }
    // Center
    const newBox = new THREE.Box3().setFromObject(s);
    const center = newBox.getCenter(new THREE.Vector3());
    s.position.sub(center);
    s.position.y -= newBox.min.y / maxDim;
    return s;
  }, [scene]);

  return <primitive object={cloned} />;
}

function ObjModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);

  const processed = useMemo(() => {
    const s = obj.clone(true);
    // Add default material if none
    s.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.material) {
        child.material = new THREE.MeshStandardMaterial({ color: "#888" });
      }
    });
    // Normalize scale
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      s.scale.multiplyScalar(2 / maxDim);
    }
    const newBox = new THREE.Box3().setFromObject(s);
    const center = newBox.getCenter(new THREE.Vector3());
    s.position.sub(center);
    s.position.y -= newBox.min.y / maxDim;
    return s;
  }, [obj]);

  return <primitive object={processed} />;
}
