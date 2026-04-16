// 全局常量: 设备检测、质量配置、坐标系、地形尺寸等

// 设备检测
export const MOB = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

// 高分辨率地形网格 (近距离 LOD)
export const SGWT = MOB ? 200 : 1920;
export const SGHT = MOB ? 150 : 1360;

// 低分辨率地形网格 (远距离 LOD)
export const LOD_LO_W = MOB ? 100 : 480;
export const LOD_LO_H = MOB ? 80 : 340;

// LOD 切换距离阈值
export const LOD_SWITCH_DIST = 95;

// 海面细分段数
export const SEA_SEG = MOB ? 32 : 48;

// 云朵数量
export const CLOUD_N = MOB ? 2 : 3;

// 河流插值点数
export const RIVER_PTS = MOB ? 160 : 380;

// DEM 瓦片参数
export const Z = 5;
export const TS = 256;
export const TX0 = 22;
export const TX1 = 27;
export const TY0 = 10;
export const TY1 = 15;
export const TC = TX1 - TX0 + 1;
export const TR_ = TY1 - TY0 + 1;
export const MW = TC * TS;
export const MH = TR_ * TS;

// 地图中心与缩放 (经纬度 → 场景坐标)
export const CL = 105;
export const CA = 34;
export const SX = 1.6;
export const SY = 1.8;

// 地形平面尺寸 (Three.js 单位)
export const PW = 130;
export const PH = 90;

// 背景基色 (烘焙着色时的底色 RGB)
export const BGC = [.60, .48, .22];
