// GLTF and GLB 3D Model Loader for custom user vehicles with texture mapping support

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js';

/**
 * SafeDDSLoader wraps Three.js DDSLoader to intercept invalid, corrupt,
 * or unsupported FourCC DDS files (like truncated or uncompressed DDS)
 * and safely return clean 1x1 fallback DataTextures instead of crashing WebGL shaders.
 */
export class SafeDDSLoader extends THREE.Loader<THREE.Texture> {
  private internalDDSLoader: DDSLoader;

  constructor(manager?: THREE.LoadingManager) {
    super(manager);
    this.internalDDSLoader = new DDSLoader(this.manager);
  }

  public parse(buffer: ArrayBuffer, loadMipmaps: boolean): any {
    if (!buffer || buffer.byteLength < 128) {
      return null;
    }
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    // DDS magic number is 0x20534444 ("DDS ")
    if (magic !== 0x20534444) {
      return null;
    }

    const fourCC = view.getUint32(84, true);
    // Supported S3TC FourCCs: DXT1 (0x31545844), DXT3 (0x33545844), DXT5 (0x35545844)
    const isSupportedFourCC = fourCC === 0x31545844 || fourCC === 0x33545844 || fourCC === 0x35545844;
    if (!isSupportedFourCC) {
      return null;
    }

    try {
      const dds = this.internalDDSLoader.parse(buffer, loadMipmaps);
      if (!dds || !dds.format || dds.format === 1023 || !Array.isArray(dds.mipmaps) || dds.mipmaps.length === 0 || !dds.width || !dds.height) {
        return null;
      }
      return dds;
    } catch {
      return null;
    }
  }

  public override load(
    url: string,
    onLoad?: (texture: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void
  ): THREE.Texture {
    const scope = this;
    const loader = new THREE.FileLoader(this.manager);
    loader.setResponseType('arraybuffer');
    loader.setRequestHeader(this.requestHeader);
    loader.setPath(this.path);
    loader.setWithCredentials(this.withCredentials);

    const isNormal = /_nm|\bnm\b|normal/i.test(url);
    const fallbackData = isNormal ? new Uint8Array([128, 128, 255, 255]) : new Uint8Array([45, 48, 52, 255]);
    const fallbackTexture = new THREE.DataTexture(fallbackData, 1, 1, THREE.RGBAFormat);
    fallbackTexture.needsUpdate = true;

    loader.load(
      url,
      function (buffer: any) {
        if (!(buffer instanceof ArrayBuffer)) {
          if (onLoad) onLoad(fallbackTexture);
          return;
        }

        const dds = scope.parse(buffer, true);
        let finalTexture: THREE.Texture;
        if (dds && dds.mipmaps && dds.mipmaps.length > 0 && dds.format) {
          finalTexture = new THREE.CompressedTexture(dds.mipmaps, dds.width, dds.height, dds.format);
          if (dds.isCubemap) {
            finalTexture.mapping = THREE.CubeReflectionMapping;
          }
        } else {
          finalTexture = fallbackTexture;
        }
        finalTexture.needsUpdate = true;
        if (onLoad) onLoad(finalTexture);
      },
      onProgress,
      function (err: unknown) {
        if (onError) onError(err);
        if (onLoad) onLoad(fallbackTexture);
      }
    );

    return fallbackTexture;
  }
}

interface TextureDef {
  key: string;
  pattern: RegExp;
  file: string;
  metalness?: number;
  roughness?: number;
  transparent?: boolean;
  opacity?: number;
  emissive?: number;
  emissiveIntensity?: number;
  isBody?: boolean;
}

const TEXTURE_DEFS: TextureDef[] = [
  { key: 'cam', pattern: /windscreen|cam|windshield|öncam|farcam/i, file: '78b1b9d801404fc98bd4cdf17a065dd4_A_cam_9.png', transparent: true, opacity: 0.30, metalness: 0.92, roughness: 0.04 },
  { key: 'far', pattern: /far_14|far/i, file: '73a35cc5398f413eae2839ff41512e6f_RGB_far_7.png', emissive: 0xffffff, emissiveIntensity: 0.4 },
  { key: 'sis', pattern: /sis/i, file: '8f3c345dac884ef49d13c2de855f42a1_RGB_sis_3.png', emissive: 0xffeeaa, emissiveIntensity: 0.3 },
  { key: 'stop', pattern: /stop/i, file: 'e74bb85f586e446da5d67a6fe1d4acb6_RGB_stop_17.png', emissive: 0xdd2222, emissiveIntensity: 0.38 },
  { key: 'vehlights', pattern: /vehlights/i, file: '2ad38fb20f604e16a2b45f25c1ab5108_RGB_vehiclelights128_5.png' },
  { key: 'sinyal', pattern: /sinyal/i, file: '3319526de48043e8923d7bc655c939c3_A_sinyal_8.png' },
  { key: 'torpido', pattern: /torpido/i, file: '359fb6826c894c64a612293b2fb879a3_RGB_indash_4.png', roughness: 0.45 },
  { key: 'direksiyon', pattern: /direksiyon/i, file: 'fbc1a54b1b0f467f90079a395d10b104_RGB_Image_10.png' },
  { key: 'jant', pattern: /jant|rim|boot_ok\.2/i, file: '9e23077c9549473389eca30386e4d937_RGB_jant_6.png', metalness: 0.85, roughness: 0.18 },
  { key: 'paspas', pattern: /paspas/i, file: '3bad87c763fc483faac2915bfadc1781_RGB_pas_takim_14.png' },
  { key: 'pusula', pattern: /pusula/i, file: '36b72ce050924f4e9c1070621c6dde46_RGB_pusula_15.png' },
  { key: 'tesisat', pattern: /tesisat|tss20/i, file: 'c61e5f65623047678d31c463b1b44584_A_tesisat_18.png', roughness: 0.4 },
  { key: 'anfi', pattern: /w400/i, file: '3ce2030aea104af5a2984020820787d9_RGB_anfi_19.png', metalness: 0.65 },
  { key: 'pandizot', pattern: /pandizot/i, file: '36ccaaa75056454aa26d980335a81166_RGB_parts interior_21.png' },
  { key: 'siyah', pattern: /siyah|paca/i, file: '5f36db0b3bab43339f7e956620deea49_RGB_syh_0.png', roughness: 0.8 },
  { key: 'metal', pattern: /egzan|cylinder|kule|biralt/i, file: '0938b3adc5ed42479593da2a5fdbfe81_RGB_metal_24.png', metalness: 0.72, roughness: 0.28 },
  { key: 'motor', pattern: /motor/i, file: '1a67409e93c74008913e8ab1e7dc1376_RGB_baterie_26.png' },
  { key: 'sar', pattern: /sar_/i, file: '573a5fc43ee54656a020b63511b24505_RGB_sariyazma_27.png' },
  { key: 'ayarli', pattern: /ayarli/i, file: 'afb55c8aca7e4ad18561deead031237c_A_bss_28.png' },
  { key: 'body', pattern: /alttak|surface|nesne|asd|b_/i, file: 'a0086f4b10fb4cbc82b258bb59c1cc79_RGB_2101_color_25.png', metalness: 0.65, roughness: 0.22, isBody: true },
  { key: 'koltuk', pattern: /koltuk/i, file: '9bdc2d375576450891665d8121b3d24a_RGB_slxkumas_12.png', roughness: 0.85 },
];

export class GLTFModelLoader {
  /**
   * Load a 3D model (GLTF, GLB, or FBX) from a public URL
   */
  public static loadFromUrl(url: string): Promise<THREE.Group> {
    if (url.toLowerCase().endsWith('.fbx')) {
      return GLTFModelLoader.loadFBXFromUrl(url);
    }

    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        async (gltf) => {
          if (url.toLowerCase().includes('tofas')) {
            try {
              await GLTFModelLoader.applyTextures(gltf.scene);
            } catch (e) {
              console.warn('[GLTFModelLoader] Auto-texture mapping warning:', e);
            }
          }
          resolve(gltf.scene);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  /**
   * Load FBX model with textures mapped dynamically from model's texture folder
   */
  public static async loadFBXFromUrl(url: string): Promise<THREE.Group> {
    console.log(`[GLTFModelLoader] Fetching FBX buffer from ${url}...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch FBX file: ${url} (HTTP ${response.status} ${response.statusText})`);
    }
    const arrayBuffer = await response.arrayBuffer();

    const manager = new THREE.LoadingManager();
    manager.addHandler(/\.dds$/i, new SafeDDSLoader(manager));
    manager.onError = (itemUrl) => {
      console.warn('[GLTFModelLoader] Non-fatal texture load warning:', itemUrl);
    };

    const basePath = url.substring(0, url.lastIndexOf('/'));
    manager.setURLModifier((assetUrl: string) => {
      if (!assetUrl || assetUrl.startsWith('data:') || assetUrl.startsWith('blob:')) {
        return assetUrl;
      }
      if (assetUrl.toLowerCase().endsWith('.fbx')) {
        return assetUrl;
      }
      const filename = assetUrl.replace(/^.*[\\/]/, '');
      return `${basePath}/texture/${filename}`;
    });

    const loader = new FBXLoader(manager);
    const group = loader.parse(arrayBuffer, `${basePath}/texture/`);
    GLTFModelLoader.processFBXMaterials(group);
    console.log(`[GLTFModelLoader] Successfully loaded and parsed FBX from ${url}`);
    return group;
  }

  /**
   * Process and calibrate FBX materials (convert to PBR MeshStandardMaterial, set glass transparency, body paint, etc.)
   */
  public static processFBXMaterials(group: THREE.Group): void {
    group.traverse((child) => {
      const childName = (child.name || '').toLowerCase();
      // Hide low-detail duplicate LOD meshes and blur disc rims
      if (/_lr$|_lr_|rim_blur|jant_blur/i.test(childName)) {
        child.visible = false;
      }

      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const fixMaterial = (m: THREE.Material): THREE.Material => {
          const matName = (m.name || '').toLowerCase();
          const meshName = (mesh.name || '').toLowerCase();
          const combined = `${meshName} ${matName}`;

          let stdMat: THREE.MeshStandardMaterial;
          if (m instanceof THREE.MeshStandardMaterial) {
            stdMat = m;
          } else {
            const old = m as any;
            stdMat = new THREE.MeshStandardMaterial({
              map: old.map || null,
              color: old.color || new THREE.Color(0xffffff),
              roughness: 0.35,
              metalness: 0.25,
              side: THREE.DoubleSide,
            });
            stdMat.name = m.name;
          }

          // 1. Windows and Glass: Clear, realistic tinted transparency so driver can see outside!
          if (/glass|cam|windscreen|windshield|window|öncam|farcam/i.test(combined)) {
            stdMat.transparent = true;
            stdMat.opacity = 0.28; // Clear for cockpit / 1st person driving view!
            stdMat.depthWrite = false;
            stdMat.roughness = 0.04;
            stdMat.metalness = 0.92;
            stdMat.side = THREE.DoubleSide;
          }
          // 2. Car Paint (Tofaş Doğan SLX Body)
          else if (/carpaint|body|xr_c|kasa|main|kaporta/i.test(combined)) {
            stdMat.transparent = false;
            stdMat.depthWrite = true;
            stdMat.metalness = 0.65;
            stdMat.roughness = 0.22;
            (stdMat as any).isBodyPaint = true;
          }
          // 3. Tail lights / Stop lamps
          else if (/stop|taillight|ch_ld_7/i.test(combined)) {
            stdMat.transparent = false;
            stdMat.depthWrite = true;
            stdMat.emissive = new THREE.Color(0.85, 0.05, 0.05);
            stdMat.emissiveIntensity = 0.48;
          }
          // 4. Headlights / Turn signals
          else if (/far|headlight|lights_lod/i.test(combined)) {
            stdMat.transparent = false;
            stdMat.depthWrite = true;
            stdMat.emissive = new THREE.Color(0.95, 0.95, 0.75);
            stdMat.emissiveIntensity = 0.35;
          }
          // 5. Tires
          else if (/lastik|tyre|tire|teker/i.test(combined)) {
            stdMat.roughness = 0.88;
            stdMat.metalness = 0.08;
          }
          // 6. Black Trim / Bumpers
          else if (/siyah|bumper|tampon|karl_k/i.test(combined)) {
            stdMat.roughness = 0.75;
            stdMat.metalness = 0.15;
          }
          // 7. Chrome / Exhaust / Rims
          else if (/egzoz|metal|jant|rim|spec/i.test(combined)) {
            stdMat.metalness = 0.88;
            stdMat.roughness = 0.15;
          }
          // 8. Interior upholstery & Cockpit
          else if (/koltuk|kumas|leather|doseme|tavan|salon|kokpit|direksiyon/i.test(combined)) {
            stdMat.side = THREE.DoubleSide;
            stdMat.roughness = 0.75;
          }

          // 9. Floor mats & specific interior plastics without valid textures
          if (/paspas/i.test(combined)) {
            stdMat.color = new THREE.Color(0x1a1a1a);
            stdMat.roughness = 0.9;
            stdMat.map = null;
          } else if (/salon_plastik/i.test(combined)) {
            stdMat.color = new THREE.Color(0x242424);
            stdMat.roughness = 0.8;
            stdMat.map = null;
          }

          // Sanitize texture maps to prevent WebGLRenderer uploadTexture crashes
          const isValidTexture = (tex: any): boolean => {
            if (!tex) return false;
            if (tex.isCompressedTexture) {
              return Array.isArray(tex.mipmaps) && tex.mipmaps.length > 0 && typeof tex.mipmaps[0]?.width === 'number' && tex.mipmaps[0]?.width > 0 && typeof tex.format === 'number' && tex.format !== 1023;
            }
            return !!tex.image;
          };

          if (stdMat.map && !isValidTexture(stdMat.map)) stdMat.map = null;
          if (stdMat.bumpMap && !isValidTexture(stdMat.bumpMap)) stdMat.bumpMap = null;
          if (stdMat.normalMap && !isValidTexture(stdMat.normalMap)) stdMat.normalMap = null;
          if (stdMat.roughnessMap && !isValidTexture(stdMat.roughnessMap)) stdMat.roughnessMap = null;
          if (stdMat.metalnessMap && !isValidTexture(stdMat.metalnessMap)) stdMat.metalnessMap = null;
          if (stdMat.aoMap && !isValidTexture(stdMat.aoMap)) stdMat.aoMap = null;

          stdMat.needsUpdate = true;
          return stdMat;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(fixMaterial);
        } else if (mesh.material) {
          mesh.material = fixMaterial(mesh.material);
        }
      }
    });
  }

  /**
   * Load a model from user-dropped files (supports .glb, .gltf + textures, or .fbx + textures)
   */
  public static loadFromFiles(files: FileList | File[]): Promise<THREE.Group> {
    const fileMap = new Map<string, File>();
    let rootFile: File | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      fileMap.set(file.name.toLowerCase(), file);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'gltf' || ext === 'glb' || ext === 'fbx') {
        rootFile = file;
      }
    }

    if (!rootFile) {
      return Promise.reject(new Error('3D model dosyası (.gltf, .glb veya .fbx) bulunamadı.'));
    }

    const ext = rootFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'fbx') {
      const manager = new THREE.LoadingManager();
      manager.addHandler(/\.dds$/i, new SafeDDSLoader(manager));
      manager.setURLModifier((url: string) => {
        const filename = url.replace(/^.*[\\/]/, '').toLowerCase();
        const matched = fileMap.get(filename);
        if (matched) {
          return URL.createObjectURL(matched);
        }
        return `/models/tofas3/texture/${filename}`;
      });

      const loader = new FBXLoader(manager);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          try {
            const group = loader.parse(buffer, '');
            GLTFModelLoader.processFBXMaterials(group);
            resolve(group);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(rootFile!);
      });
    }

    const manager = new THREE.LoadingManager();
    const objectURLs: string[] = [];

    // Remap relative asset URLs (like buffer.bin or texture.png) to local blob URLs
    manager.setURLModifier((url: string) => {
      const filename = url.replace(/^.*[\\/]/, '').toLowerCase();
      const matchedFile = fileMap.get(filename);
      if (matchedFile) {
        const blobUrl = URL.createObjectURL(matchedFile);
        objectURLs.push(blobUrl);
        return blobUrl;
      }
      return url;
    });

    const loader = new GLTFLoader(manager);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          reject(new Error('Dosya okunamadı'));
          return;
        }

        loader.parse(
          arrayBuffer,
          '',
          async (gltf) => {
            try {
              await GLTFModelLoader.applyTextures(gltf.scene, fileMap);
            } catch (err) {
              console.warn('[GLTFModelLoader] Dropped textures application warning:', err);
            }
            // Clean up blob URLs after parse
            objectURLs.forEach((u) => URL.revokeObjectURL(u));
            resolve(gltf.scene);
          },
          (err) => {
            objectURLs.forEach((u) => URL.revokeObjectURL(u));
            reject(err);
          }
        );
      };
      reader.onerror = (err) => {
        objectURLs.forEach((u) => URL.revokeObjectURL(u));
        reject(err);
      };

      reader.readAsArrayBuffer(rootFile);
    });
  }

  /**
   * Apply realistic PBR texture maps to the vehicle parts
   */
  public static async applyTextures(model: THREE.Group, fileMap?: Map<string, File>): Promise<void> {
    const texLoader = new THREE.TextureLoader();
    const loadedTextures = new Map<string, THREE.Texture>();

    const getTexture = async (def: TextureDef): Promise<THREE.Texture | null> => {
      if (loadedTextures.has(def.key)) {
        return loadedTextures.get(def.key)!;
      }

      let srcUrl: string | null = null;
      if (fileMap) {
        for (const [name, file] of fileMap.entries()) {
          if (name.includes(def.key) || name.includes(def.file.toLowerCase())) {
            srcUrl = URL.createObjectURL(file);
            break;
          }
        }
      }

      if (!srcUrl) {
        srcUrl = `/models/Texture/${def.file}`;
      }

      try {
        const tex = await new Promise<THREE.Texture>((resolve, reject) => {
          texLoader.load(
            srcUrl!,
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              t.flipY = false;
              t.wrapS = THREE.RepeatWrapping;
              t.wrapT = THREE.RepeatWrapping;
              resolve(t);
            },
            undefined,
            (err) => reject(err)
          );
        });
        loadedTextures.set(def.key, tex);
        return tex;
      } catch {
        return null;
      }
    };

    // Preload textures in parallel
    await Promise.all(TEXTURE_DEFS.map((def) => getTexture(def)));

    // Traverse all meshes and assign textures
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const pName = (mesh.parent?.name || '').toLowerCase();
        const mName = (mesh.name || '').toLowerCase();
        const matName = (mesh.material && !Array.isArray(mesh.material) ? mesh.material.name : '').toLowerCase();
        const full = `${pName}_${mName}_${matName}`;

        // 1. Wheel and Tire meshes: NEVER assign seat upholstery fabric!
        const isUnderWheel = /wheel|teker|jant/i.test(pName) || /wheel|teker|jant/i.test(mName);
        if (isUnderWheel) {
          if (/boot_ok\.2|jant|rim/i.test(matName + ' ' + mName)) {
            const jantTex = loadedTextures.get('jant');
            mesh.material = new THREE.MeshStandardMaterial({
              map: jantTex || null,
              metalness: 0.88,
              roughness: 0.16,
              color: new THREE.Color(0xdddddd),
            });
          } else {
            // Matte black rubber tire!
            mesh.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0x1a1c1e),
              roughness: 0.92,
              metalness: 0.05,
            });
          }
          return;
        }

        // 2. Windows / Glass: Clear, realistic tinted glass for cockpit view
        if (/cam|windscreen|windshield|window|öncam|farcam/i.test(full)) {
          const camTex = loadedTextures.get('cam');
          mesh.material = new THREE.MeshStandardMaterial({
            map: camTex || null,
            roughness: 0.04,
            metalness: 0.92,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
          });
          return;
        }

        // 3. Body paint meshes (Tofaş GLTF: primary, kasa, boot_ok doors/trunk, kaporta, bonnet)
        if (/primary|kasa|kaporta|bonnet|tavan|camurluk|boot_ok\.[3-9]|boot_ok_[3-9]/i.test(full)) {
          const bodyMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x1e7272),
            roughness: 0.22,
            metalness: 0.65,
            side: THREE.DoubleSide,
          });
          bodyMat.name = 'primary';
          (bodyMat as any).isBodyPaint = true;
          mesh.material = bodyMat;
          return;
        }

        for (const def of TEXTURE_DEFS) {
          if (def.pattern.test(full)) {
            const tex = loadedTextures.get(def.key);
            if (tex) {
              const mat = new THREE.MeshStandardMaterial({
                map: tex,
                roughness: def.roughness ?? 0.35,
                metalness: def.metalness ?? 0.3,
                side: THREE.DoubleSide,
                transparent: !!def.transparent,
                opacity: def.opacity ?? 1.0,
                depthWrite: !def.transparent,
              });

              if (def.emissive) {
                mat.emissive = new THREE.Color(def.emissive);
                mat.emissiveIntensity = def.emissiveIntensity ?? 0.3;
              }

              mat.name = def.key;
              if (def.isBody) {
                (mat as any).isBodyPaint = true;
              }

              mesh.material = mat;
              break;
            }
          }
        }
      }
    });
  }
}

export const gltfModelLoader = GLTFModelLoader;
