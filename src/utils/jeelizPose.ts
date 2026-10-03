import * as THREE from 'three';

export interface FaceDetection {
  detected: number; x: number; y: number; s: number;
  rx: number; ry: number; rz: number;
}

// Filter detector coordinates before projection: rotation and its pivot translation
// must use the same pose, otherwise independently smoothed transforms slide apart.
export class JeelizPoseTracker {
  private pose: FaceDetection | null = null;
  private previous: FaceDetection | null = null;
  private velocity = { x: 0, y: 0, s: 0, rx: 0, ry: 0, rz: 0 };
  private timestamp = 0;
  reset() { this.pose = this.previous = null; this.timestamp = 0; }
  update(input: FaceDetection, now: number): FaceDetection {
    if (!this.pose || !this.previous || now - this.timestamp > 250) {
      this.pose = { ...input }; this.previous = { ...input };
      for (const key of Object.keys(this.velocity) as (keyof typeof this.velocity)[]) this.velocity[key] = 0;
      this.timestamp = now;
      return this.pose;
    }
    const dt = THREE.MathUtils.clamp((now - this.timestamp) / 1000, 0.001, 0.1);
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    for (const key of Object.keys(this.velocity) as (keyof typeof this.velocity)[]) {
      const angular = key === 'rx' || key === 'ry' || key === 'rz';
      const delta = angular
        ? Math.atan2(Math.sin(input[key] - this.previous[key]), Math.cos(input[key] - this.previous[key]))
        : input[key] - this.previous[key];
      this.velocity[key] += alpha(1.5) * (delta / dt - this.velocity[key]);
      const cutoff = (key === 's' ? 1.8 : 3) + (angular ? 5 : 24) * Math.abs(this.velocity[key]);
      const error = angular
        ? Math.atan2(Math.sin(input[key] - this.pose[key]), Math.cos(input[key] - this.pose[key]))
        : input[key] - this.pose[key];
      this.pose[key] += alpha(cutoff) * error;
    }
    this.pose.detected = input.detected;
    this.previous = { ...input }; this.timestamp = now;
    return this.pose;
  }
}

export function projectJeelizPose(
  pose: FaceDetection, camera: THREE.PerspectiveCamera,
  position: THREE.Vector3, quaternion: THREE.Quaternion,
): number {
  const tanX = camera.aspect * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const depth = 1 / (2 * Math.max(0.015, pose.s) * tanX) + 0.5;
  quaternion.setFromEuler(new THREE.Euler(pose.rx, pose.ry, pose.rz, 'ZYX'));
  // Official Jeeliz unit-cube pivot: rotate about the skull, not the front lenses.
  const sinZ = Math.sin(pose.rz), cosZ = Math.cos(pose.rz);
  position.set(-sinZ * 0.2, -cosZ * 0.2, -0.6).applyQuaternion(quaternion);
  position.x += pose.x * depth * tanX;
  position.y += pose.y * depth * tanX / camera.aspect + 0.2;
  position.z += -depth + 0.6;
  return depth;
}
