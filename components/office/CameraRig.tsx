"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CameraControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_FOCUS_OFFSET, CAMERA_HOME, CAMERA_MEETING } from "@/components/office/layout";

export type CameraApi = {
  home: () => void;
  meeting: () => void;
  focus: (object: THREE.Object3D) => void;
  zoom: (step: number) => void;
};

type View = { position: readonly [number, number, number]; target: readonly [number, number, number] };

/** Afasta a câmera em telas estreitas (celular em pé) para caber o escritório. */
function fitFactor(aspect: number) {
  return Math.min(2.3, Math.max(1, 1.55 / aspect));
}

/**
 * Câmera com transições suaves (voar até um agente, ir para a mesa geral,
 * voltar para a visão geral). Arrastar gira, botão direito move, roda aproxima.
 */
export default function CameraRig({ apiRef }: { apiRef: RefObject<CameraApi | null> }) {
  const controls = useRef<CameraControls>(null);
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height));
  const aspectRef = useRef(aspect);

  useEffect(() => {
    aspectRef.current = aspect;
  }, [aspect]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;

    const go = (view: View, scale: number, smooth: boolean) => {
      const [tx, ty, tz] = view.target;
      const [px, py, pz] = view.position;
      void c.setLookAt(
        tx + (px - tx) * scale,
        ty + (py - ty) * scale,
        tz + (pz - tz) * scale,
        tx,
        ty,
        tz,
        smooth
      );
    };

    c.setBoundary(new THREE.Box3(new THREE.Vector3(-10.5, -0.5, -6.6), new THREE.Vector3(10.5, 3.5, 6.8)));
    go(CAMERA_HOME, fitFactor(aspectRef.current), false);

    const target = new THREE.Vector3();
    apiRef.current = {
      home: () => go(CAMERA_HOME, fitFactor(aspectRef.current), true),
      meeting: () => go(CAMERA_MEETING, Math.min(1.6, fitFactor(aspectRef.current)), true),
      focus: (object) => {
        object.getWorldPosition(target);
        const scale = Math.min(1.5, fitFactor(aspectRef.current));
        const [ox, oy, oz] = CAMERA_FOCUS_OFFSET;
        void c.setLookAt(
          target.x + ox * scale,
          target.y + oy * scale,
          target.z + oz * scale,
          target.x,
          target.y + 0.8,
          target.z,
          true
        );
      },
      zoom: (step) => {
        void c.dolly(step, true);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={3}
      maxDistance={46}
      minPolarAngle={0.18}
      maxPolarAngle={1.25}
      minAzimuthAngle={-0.75}
      maxAzimuthAngle={1.3}
      smoothTime={0.55}
      draggingSmoothTime={0.12}
      dollyToCursor
    />
  );
}
