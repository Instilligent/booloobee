/**
 * Runtime visual upgrades — richer workers/characters + visible movement.
 * Installed from GameApp so we do not need to re-push the full engine.ts.
 */
import * as THREE from "three";

type AnyEng = any;

export function installVisualUpgrades(eng: AnyEng) {
  if (eng.__visualUpgrades) return;
  eng.__visualUpgrades = true;

  const geo = eng.geo;
  const mats = eng.mats;
  if (!geo || !mats) return;

  eng.makeWorkerMesh = function (role: string, index: number) {
    const g = new THREE.Group();
    const colors: Record<string, number> = {
      farmer: 0x5ecf4a,
      grinder: 0x3ab8ff,
      vendor: 0xffb84a,
      bot: 0x6bc8ff,
    };
    const accent: Record<string, number> = {
      farmer: 0xffe14a,
      grinder: 0xb0e0ff,
      vendor: 0xff6bb5,
      bot: 0xffe14a,
    };
    const col = colors[role] ?? 0x7ad46a;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.55,
      emissive: col,
      emissiveIntensity: 0.1,
    });
    const skin = new THREE.MeshStandardMaterial({ color: 0xffe0cc, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2a1a40, roughness: 0.85 });

    if (role === "bot") {
      const body = new THREE.Mesh(geo.box, bodyMat);
      body.scale.set(0.85, 0.65, 0.85);
      body.position.y = 0.5;
      body.castShadow = true;
      g.add(body);
      const dome = new THREE.Mesh(geo.sphere, bodyMat);
      dome.scale.set(0.42, 0.34, 0.42);
      dome.position.y = 1.0;
      g.add(dome);
      const light = new THREE.Mesh(
        geo.sphere,
        new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffaa00, emissiveIntensity: 1.2 }),
      );
      light.scale.setScalar(0.14);
      light.position.y = 1.4;
      light.name = "spin";
      g.add(light);
      const armL = new THREE.Mesh(geo.box, bodyMat);
      armL.scale.set(0.18, 0.45, 0.18);
      armL.position.set(-0.55, 0.55, 0);
      armL.name = "armL";
      g.add(armL);
      const armR = armL.clone();
      armR.position.x = 0.55;
      armR.name = "armR";
      g.add(armR);
      g.scale.setScalar(1.15);
      return g;
    }

    const legL = new THREE.Mesh(geo.box, pantsMat);
    legL.scale.set(0.18, 0.48, 0.22);
    legL.position.set(-0.14, 0.28, 0);
    legL.name = "legL";
    legL.castShadow = true;
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.14;
    legR.name = "legR";
    g.add(legR);

    const body = new THREE.Mesh(geo.cyl, bodyMat);
    body.scale.set(0.48, 0.58, 0.38);
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);

    const armL = new THREE.Mesh(geo.box, bodyMat);
    armL.scale.set(0.14, 0.42, 0.14);
    armL.position.set(-0.4, 0.9, 0);
    armL.name = "armL";
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.4;
    armR.name = "armR";
    g.add(armR);

    const toolMat = new THREE.MeshStandardMaterial({
      color: accent[role] ?? 0xffe14a,
      metalness: 0.4,
      roughness: 0.35,
      emissive: accent[role] ?? 0xffe14a,
      emissiveIntensity: 0.35,
    });
    const tool = new THREE.Mesh(geo.box, toolMat);
    if (role === "farmer") {
      tool.scale.set(0.08, 0.55, 0.08);
      tool.position.set(0.42, 0.75, 0.25);
    } else if (role === "grinder") {
      tool.scale.set(0.22, 0.22, 0.22);
      tool.position.set(0.45, 0.7, 0.2);
    } else {
      tool.scale.set(0.28, 0.18, 0.22);
      tool.position.set(0.45, 0.7, 0.2);
    }
    tool.name = "tool";
    g.add(tool);

    const head = new THREE.Mesh(geo.sphere, skin);
    head.scale.setScalar(0.32);
    head.position.y = 1.35;
    head.castShadow = true;
    g.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1028 });
    const eyeL = new THREE.Mesh(geo.sphere, eyeMat);
    eyeL.scale.setScalar(0.055);
    eyeL.position.set(-0.1, 1.4, 0.26);
    g.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    g.add(eyeR);

    if (role === "farmer") {
      const hat = new THREE.Mesh(geo.cyl, bodyMat);
      hat.scale.set(0.42, 0.12, 0.42);
      hat.position.y = 1.58;
      g.add(hat);
      const brim = new THREE.Mesh(geo.cyl, bodyMat);
      brim.scale.set(0.62, 0.05, 0.62);
      brim.position.y = 1.52;
      g.add(brim);
    } else if (role === "grinder") {
      const hat = new THREE.Mesh(geo.cyl, bodyMat);
      hat.scale.set(0.36, 0.22, 0.36);
      hat.position.y = 1.62;
      g.add(hat);
    } else {
      const hat = new THREE.Mesh(geo.cone, bodyMat);
      hat.scale.set(0.3, 0.4, 0.3);
      hat.position.y = 1.7;
      g.add(hat);
    }

    if (typeof this.makeTextSprite === "function") {
      const label =
        role === "farmer" ? "FARMER" : role === "grinder" ? "SPA" : role === "vendor" ? "VENDOR" : "BOT";
      const bg =
        role === "farmer" ? "#2a6a28" : role === "grinder" ? "#1a5a8a" : role === "vendor" ? "#8a5a10" : "#1a4a6a";
      const badge = this.makeTextSprite([label, ""], bg);
      badge.position.y = 2.15;
      badge.scale.set(1.8, 0.7, 1);
      badge.name = "badge";
      g.add(badge);
    }

    g.scale.setScalar(1.12 + index * 0.05);
    return g;
  };

  const origUpdate = eng.updateWorkers?.bind(eng);
  eng.updateWorkers = function (dt: number) {
    if (origUpdate) origUpdate(dt);
    if (this.screen !== "playing") return;
    for (const w of this.workers || []) {
      if (w.role === "bot") continue;
      if (w.role === "farmer" && (!w.targetCrop || w.targetCrop.harvested)) {
        if (!w.targetCrop && w.timer > 0.4) {
          w.timer = 0;
          const angle = Math.random() * Math.PI * 2;
          const step = 1.4 + Math.random() * 2;
          const cx = this.level?.spawn?.x ?? 0;
          const cz = this.level?.spawn?.z ?? 0;
          w.pos.x = THREE.MathUtils.clamp(w.pos.x + Math.cos(angle) * step, cx - 10, cx + 10);
          w.pos.z = THREE.MathUtils.clamp(w.pos.z + Math.sin(angle) * step, cz - 10, cz + 8);
          w.mesh.rotation.y = angle;
        }
      }
      const moving =
        w.role === "farmer"
          ? !!(w.targetCrop && Math.hypot(w.targetCrop.pos.x - w.pos.x, w.targetCrop.pos.z - w.pos.z) > 0.55)
          : true;
      w.mesh.position.x = w.pos.x;
      w.mesh.position.z = w.pos.z;
      const bob =
        Math.abs(Math.sin(this.clock.elapsedTime * (moving ? 10 : 3) + w.timer * 2)) * (moving ? 0.12 : 0.05);
      w.mesh.position.y = bob;
      const swing = moving
        ? Math.sin(this.clock.elapsedTime * 10 + w.timer) * 0.55
        : Math.sin(this.clock.elapsedTime * 2) * 0.08;
      const legL = w.mesh.getObjectByName("legL");
      const legR = w.mesh.getObjectByName("legR");
      const armL = w.mesh.getObjectByName("armL");
      const armR = w.mesh.getObjectByName("armR");
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (armL) armL.rotation.x = -swing * 0.7;
      if (armR) armR.rotation.x = swing * 0.7;
      const badge = w.mesh.getObjectByName("badge");
      if (badge) {
        badge.lookAt(this.camera.position);
        badge.position.y = 2.2 + Math.sin(this.clock.elapsedTime * 3 + w.timer) * 0.06;
      }
    }
  };

  if (typeof eng.syncWorkers === "function" && eng.screen === "playing") {
    eng.syncWorkers();
  }

  const origPlayer = eng.updatePlayer?.bind(eng);
  if (origPlayer) {
    eng.updatePlayer = function (dt: number) {
      origPlayer(dt);
      if (!this.playerMesh) return;
      const moving = Math.hypot(this.playerVel.x, this.playerVel.z) > 2 && this.onGround;
      const swing = moving ? Math.sin(this.clock.elapsedTime * 11) * 0.65 : 0;
      for (const [name, mul] of [
        ["legL", 1],
        ["legR", -1],
        ["armL", -0.55],
        ["armR", 0.55],
      ] as const) {
        const part = this.playerMesh.getObjectByName(name);
        if (part) part.rotation.x = swing * mul;
      }
    };
  }

  const origPlayerMesh = eng.makePlayerMesh?.bind(eng);
  eng.makePlayerMesh = function () {
    const g = origPlayerMesh ? origPlayerMesh() : new THREE.Group();
    if (!g.getObjectByName("legL")) {
      const pants = new THREE.MeshStandardMaterial({ color: 0x4a3a6e, roughness: 0.8 });
      const legL = new THREE.Mesh(geo.box, pants);
      legL.scale.set(0.2, 0.5, 0.24);
      legL.position.set(-0.15, 0.32, 0);
      legL.name = "legL";
      g.add(legL);
      const legR = legL.clone();
      legR.position.x = 0.15;
      legR.name = "legR";
      g.add(legR);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffe8f4, roughness: 0.6 });
      const armL = new THREE.Mesh(geo.box, bodyMat);
      armL.scale.set(0.14, 0.45, 0.14);
      armL.position.set(-0.45, 1.0, 0);
      armL.name = "armL";
      g.add(armL);
      const armR = armL.clone();
      armR.position.x = 0.45;
      armR.name = "armR";
      g.add(armR);
    }
    return g;
  };
}
