<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { message } from "ant-design-vue";
import {
  CopyOutlined,
  ReloadOutlined,
  IdcardOutlined,
  UserOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PictureOutlined,
  UploadOutlined,
} from "@ant-design/icons-vue";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";

const activeTab = ref("idcard");
const generating = ref(false);

// 身份证配置
const idcardConfig = ref({
  region: "110000",
  birthYear: new Date().getFullYear() - 25,
  birthMonth: 1,
  birthDay: 1,
  gender: "male",
  count: 10,
});

// 永居证配置
const permanentConfig = ref({
  birthYear: new Date().getFullYear() - 30,
  birthMonth: 1,
  birthDay: 1,
  gender: "male",
  version: "new", // 'new' | 'old'
  count: 10,
});

// 港澳台通行证配置 (回乡证/台胞证)
const permitConfig = ref({
  type: "HK",
  count: 10,
});

// 港澳台居住证配置
const residenceConfig = ref({
  // region: "110000", // 移除，居住证前6位是固定的
  birthYear: new Date().getFullYear() - 25,
  birthMonth: 1,
  birthDay: 1,
  gender: "male",
  type: "HK",
  count: 10,
});

const results = ref([]);

// 地区码数据
const regions = [
  { value: "110000", label: "北京市" },
  { value: "120000", label: "天津市" },
  { value: "310000", label: "上海市" },
  { value: "500000", label: "重庆市" },
  { value: "130000", label: "河北省" },
  { value: "140000", label: "山西省" },
  { value: "210000", label: "辽宁省" },
  { value: "220000", label: "吉林省" },
  { value: "230000", label: "黑龙江省" },
  { value: "320000", label: "江苏省" },
  { value: "330000", label: "浙江省" },
  { value: "340000", label: "安徽省" },
  { value: "350000", label: "福建省" },
  { value: "360000", label: "江西省" },
  { value: "370000", label: "山东省" },
  { value: "410000", label: "河南省" },
  { value: "420000", label: "湖北省" },
  { value: "430000", label: "湖南省" },
  { value: "440000", label: "广东省" },
  { value: "450000", label: "广西壮族自治区" },
  { value: "460000", label: "海南省" },
  { value: "510000", label: "四川省" },
  { value: "520000", label: "贵州省" },
  { value: "530000", label: "云南省" },
  { value: "610000", label: "陕西省" },
  { value: "620000", label: "甘肃省" },
  { value: "640000", label: "宁夏回族自治区" },
  { value: "650000", label: "新疆维吾尔自治区" },
];

// 计算校验码 (18位身份证/居住证/新版永居证)
const calcCheckCode = (idcard17) => {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idcard17[i]) * weights[i];
  }
  return checkCodes[sum % 11];
};

// 计算旧版永居证校验码（2位）
const calcPermanentCheckCodeOld = (permanent13) => {
  let sum = 0;
  for (let i = 0; i < permanent13.length; i++) {
    const char = permanent13[i];
    const value =
      char >= "A" && char <= "Z" ? char.charCodeAt(0) - 55 : parseInt(char);
    sum += value;
  }
  return String(sum % 100).padStart(2, "0");
};

// 生成身份证
const generateIdCard = () => {
  const { region, birthYear, birthMonth, birthDay, gender, count } =
    idcardConfig.value;
  const list = [];

  for (let i = 0; i < count; i++) {
    const date = `${birthYear}${String(birthMonth).padStart(2, "0")}${String(
      birthDay
    ).padStart(2, "0")}`;
    const seq = String(
      Math.floor(Math.random() * 500) * 2 + (gender === "male" ? 1 : 0)
    ).padStart(3, "0");
    const id17 = region + date + seq;
    const checkCode = calcCheckCode(id17);
    const idcard = id17 + checkCode;

    const age = new Date().getFullYear() - birthYear;
    const regionName = regions.find((r) => r.value === region)?.label || "未知";

    list.push({
      id: Date.now() + i,
      number: idcard,
      type: "居民身份证",
      info: `${regionName} | ${birthYear}-${String(birthMonth).padStart(
        2,
        "0"
      )}-${String(birthDay).padStart(2, "0")} | ${
        gender === "male" ? "男" : "女"
      } | ${age}岁`,
    });
  }

  return list;
};

// 生成永居证
const generatePermanent = () => {
  const { birthYear, birthMonth, birthDay, version, gender, count } =
    permanentConfig.value;
  const list = [];

  for (let i = 0; i < count; i++) {
    let number = "";
    let info = "";

    if (version === "old") {
      // 15位旧版: 3位国家码(CHN)+4位地区码+6位日期+2位校验码
      const countryCode = "CHN"; // 默认用CHN，实际可能是其他
      const regionCode = String(Math.floor(Math.random() * 9000) + 1000);
      const yearShort = String(birthYear).slice(-2);
      const dateCode = `${yearShort}${String(birthMonth).padStart(
        2,
        "0"
      )}${String(birthDay).padStart(2, "0")}`;
      const permanent13 = `${countryCode}${regionCode}${dateCode}`;
      const checkCode = calcPermanentCheckCodeOld(permanent13);
      number = permanent13 + checkCode;
      info = `旧版(15位) | ${birthYear}年`;
    } else {
      // 18位新版(五星卡): 9 + 5位地区码(模拟) + 8位日期 + 3位顺序码 + 校验码
      // 实际上前6位规则复杂，这里模拟: 9 + 任意5位数字(模拟地区)
      // 或者为了看起来像真的，用 9 + 11000 (北京)
      const regionCode =
        "9" + String(Math.floor(Math.random() * 90000) + 10000); // 9xxxxx (6位)
      const date = `${birthYear}${String(birthMonth).padStart(2, "0")}${String(
        birthDay
      ).padStart(2, "0")}`;
      const seq = String(
        Math.floor(Math.random() * 500) * 2 + (gender === "male" ? 1 : 0)
      ).padStart(3, "0");
      const id17 = regionCode + date + seq;
      const checkCode = calcCheckCode(id17);
      number = id17 + checkCode;
      info = `新版五星卡(18位) | ${
        gender === "male" ? "男" : "女"
      } | ${birthYear}年`;
    }

    list.push({
      id: Date.now() + i,
      number,
      type: "外国人永居证",
      info: info,
    });
  }

  return list;
};

// 生成港澳台通行证 (回乡证/台胞证)
const generatePermit = () => {
  const { type, count } = permitConfig.value;
  const list = [];
  const typeMap = {
    HK: "香港(回乡证)",
    MO: "澳门(回乡证)",
    TW: "台湾(台胞证)",
  };

  for (let i = 0; i < count; i++) {
    let number = "";
    if (type === "HK") {
      // H + 8位数字
      const seq = String(Math.floor(Math.random() * 100000000)).padStart(
        8,
        "0"
      );
      number = `H${seq}`;
    } else if (type === "MO") {
      // M + 8位数字
      const seq = String(Math.floor(Math.random() * 100000000)).padStart(
        8,
        "0"
      );
      number = `M${seq}`;
    } else if (type === "TW") {
      // 8位数字
      const seq = String(Math.floor(Math.random() * 100000000)).padStart(
        8,
        "0"
      );
      number = `${seq}`;
    }

    list.push({
      id: Date.now() + i,
      number,
      type: `${typeMap[type]}`,
      info: `通行证`,
    });
  }

  return list;
};

// 生成港澳台居住证
const generateResidence = () => {
  const { birthYear, birthMonth, birthDay, gender, type, count } =
    residenceConfig.value;
  const list = [];
  const typeMap = { HK: "香港", MO: "澳门", TW: "台湾" };
  const regionMap = { HK: "810000", MO: "820000", TW: "830000" };

  for (let i = 0; i < count; i++) {
    const region = regionMap[type];
    const date = `${birthYear}${String(birthMonth).padStart(2, "0")}${String(
      birthDay
    ).padStart(2, "0")}`;
    const seq = String(
      Math.floor(Math.random() * 500) * 2 + (gender === "male" ? 1 : 0)
    ).padStart(3, "0");
    const id17 = region + date + seq;
    const checkCode = calcCheckCode(id17);
    const number = id17 + checkCode;

    const age = new Date().getFullYear() - birthYear;

    list.push({
      id: Date.now() + i,
      number,
      type: `${typeMap[type]}居住证`,
      info: `${region} | ${birthYear}-${String(birthMonth).padStart(
        2,
        "0"
      )}-${String(birthDay).padStart(2, "0")} | ${
        gender === "male" ? "男" : "女"
      } | ${age}岁`,
    });
  }

  return list;
};

// 生成证件
const handleGenerate = () => {
  generating.value = true;

  setTimeout(() => {
    if (activeTab.value === "idcard") {
      results.value = generateIdCard();
    } else if (activeTab.value === "permanent") {
      results.value = generatePermanent();
    } else if (activeTab.value === "permit") {
      results.value = generatePermit();
    } else if (activeTab.value === "residence") {
      results.value = generateResidence();
    }

    generating.value = false;
    message.success(`已生成 ${results.value.length} 条记录`);
  }, 300);
};

// 复制单条
const copyItem = (number) => {
  navigator.clipboard.writeText(number);
  message.success("已复制到剪贴板");
};

// 批量复制
const copyAll = () => {
  const text = results.value.map((r) => r.number).join("\n");
  navigator.clipboard.writeText(text);
  message.success(`已复制 ${results.value.length} 条记录`);
};

// 导出为TXT
const exportToTxt = async () => {
  if (results.value.length === 0) {
    message.warning("没有可导出的数据");
    return;
  }

  try {
    const desktop = (await homeDir()) + "Desktop/";
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const defaultPath = `${desktop}证件号码_${timestamp}.txt`;

    const filePath = await save({
      defaultPath,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });

    if (filePath) {
      const content = results.value.map((r) => r.number).join("\n");
      await writeTextFile(filePath, content);
      message.success("导出成功");
    }
  } catch (error) {
    message.error("导出失败: " + error.message);
  }
};

const yearOptions = computed(() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 100 }, (_, i) => ({
    value: current - i,
    label: `${current - i}年`,
  }));
});
const monthOptions = computed(() => {
  return Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}月`,
  }));
});

const dayOptions = computed(() => {
  return Array.from({ length: 31 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}日`,
  }));
});

const countOptions = computed(() => {
  return Array.from({ length: 50 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}条`,
  }));
});

// 预设模板配置（使用相对位置百分比）
const templates = {
  idcard_front: {
    name: "身份证正面",
    fontSize: 0.04, // 相对于图片宽度的比例
    fields: [
      { id: "name", label: "姓名", text: "张三", x: 0.25, y: 0.35 },
      { id: "gender", label: "性别", text: "男", x: 0.25, y: 0.45 },
      { id: "nation", label: "民族", text: "汉", x: 0.50, y: 0.45 },
      { id: "birth", label: "出生日期", text: "1990年01月01日", x: 0.25, y: 0.55 },
      { id: "address", label: "住址", text: "北京市朝阳区某某街道\n某某小区某某号楼某某单元", x: 0.25, y: 0.65, multiline: true },
      { id: "idcard", label: "身份证号码", text: "110101199001011234", x: 0.25, y: 0.80 },
    ]
  },
  idcard_back: {
    name: "身份证背面",
    fontSize: 0.04,
    fields: [
      { id: "issuer", label: "签发机关", text: "北京市公安局朝阳分局", x: 0.35, y: 0.50 },
      { id: "validity", label: "有效期限", text: "2020.01.01-2030.01.01", x: 0.35, y: 0.65 },
    ]
  },
  custom: {
    name: "自定义",
    fontSize: 0.04,
    fields: [
      { id: "name", label: "姓名", text: "张三", x: 0.15, y: 0.20 },
      { id: "gender", label: "性别", text: "男", x: 0.15, y: 0.30 },
      { id: "nation", label: "民族", text: "汉", x: 0.15, y: 0.40 },
      { id: "birth", label: "出生日期", text: "1990年01月01日", x: 0.15, y: 0.50 },
      { id: "idcard", label: "身份证号码", text: "110101199001011234", x: 0.15, y: 0.60 },
      { id: "address", label: "住址", text: "北京市朝阳区某某街道\n某某小区某某号楼某某单元", x: 0.15, y: 0.70, multiline: true },
      { id: "issuer", label: "签发机关", text: "北京市公安局朝阳分局", x: 0.15, y: 0.80 },
      { id: "validity", label: "有效期限", text: "2020.01.01-2030.01.01", x: 0.15, y: 0.90 },
    ]
  }
};

// 证件编辑器配置
const editorConfig = ref({
  fontSize: 36,
  fontColor: "#000000",
  fontFamily: "SimSun",
  backgroundColor: "#ffffff",
});

const selectedTemplate = ref("idcard_front");
const activeCollapseKeys = ref(["2", "3"]);

const textFields = ref([
  { id: "name", label: "姓名", text: "", x: 100, y: 100 },
  { id: "gender", label: "性别", text: "", x: 100, y: 140 },
  { id: "nation", label: "民族", text: "", x: 100, y: 180 },
  { id: "birth", label: "出生日期", text: "", x: 100, y: 220 },
  { id: "idcard", label: "身份证号码", text: "", x: 100, y: 260 },
  { id: "address", label: "住址", text: "", x: 100, y: 300 },
  { id: "issuer", label: "签发机关", text: "", x: 100, y: 340 },
  { id: "validity", label: "有效期限", text: "", x: 100, y: 380 },
]);

const canvasRef = ref(null);
const canvasSize = ref({ width: 0, height: 0 });
const backgroundImage = ref(null);
const isDragging = ref(false);
const selectedField = ref(null);
const dragOffset = ref({ x: 0, y: 0 });

// 人脸图片相关
const faceImage = ref(null);
const facePosition = ref({ x: 100, y: 100, width: 150, height: 200 });
const isDraggingFace = ref(false);
const isResizingFace = ref(false);
const faceResizeHandle = ref(null); // 'se' | 'sw' | 'ne' | 'nw'
const faceStartPos = ref({ x: 0, y: 0 });

// 预设证件图片模板列表
const presetTemplates = ref([
  { value: 'sfz1.jpg', label: '身份证正面模板1' },
  { value: 'sfz2.jpg', label: '身份证正面模板2' },
  { value: 'sfz1-back.jpg', label: '身份证背面模板1' }
]);
const selectedPresetTemplate = ref(null);

// 应用模板布局
const applyTemplate = (imgWidth, imgHeight) => {
  const template = templates[selectedTemplate.value];
  if (!template) return;

  // 根据图片宽度计算字体大小
  const defaultFontSize = Math.round(imgWidth * template.fontSize);
  editorConfig.value.fontSize = defaultFontSize;

  // 根据模板更新字段位置和内容
  textFields.value = template.fields.map(field => {
    const existingField = textFields.value.find(f => f.id === field.id);
    return {
      id: field.id,
      label: field.label,
      text: existingField?.text || field.text || "",
      x: Math.round(imgWidth * field.x),
      y: Math.round(imgHeight * field.y),
      fontSize: existingField?.fontSize || null, // 每个字段独立字体大小，默认为null使用全局字体
      multiline: field.multiline || false, // 是否支持多行
    };
  });
};

// 加载预设模板图片
const loadPresetTemplate = async () => {
  if (!selectedPresetTemplate.value) {
    message.warning("请选择预设模板");
    return;
  }

  try {
    // 使用相对路径加载图片
    const imagePath = `/src/assets/img/idcard/${selectedPresetTemplate.value}`;
    const img = new Image();
    img.onload = async () => {
      backgroundImage.value = img;
      await nextTick();

      const canvas = canvasRef.value;
      if (canvas) {
        canvas.width = img.width;
        canvas.height = img.height;
        canvasSize.value = { width: img.width, height: img.height };
        applyTemplate(img.width, img.height);
        drawCanvas();
        message.success("预设模板加载成功");
      }
    };
    img.onerror = () => {
      message.error("预设模板加载失败");
    };
    img.src = imagePath;
  } catch (error) {
    message.error("预设模板加载失败: " + error.message);
  }
};

// 上传人脸图片
const uploadFaceImage = async () => {
  // 检查是否已上传证件图片
  if (!backgroundImage.value) {
    message.warning("请先上传证件图片或选择预设模板");
    return;
  }

  try {
    const file = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg"] }],
    });
    if (file) {
      const bytes = await readFile(file);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        faceImage.value = img;
        // 根据图片比例设置初始大小
        const aspectRatio = img.width / img.height;
        facePosition.value = {
          x: 100,
          y: 100,
          width: 150,
          height: Math.round(150 / aspectRatio)
        };
        drawCanvas();
        message.success("人脸图片上传成功");
      };
      img.src = url;
    }
  } catch (error) {
    message.error("人脸图片上传失败: " + error.message);
  }
};

// 上传图片
const uploadImage = async () => {
  try {
    const file = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg"] }],
    });
    if (file) {
      const bytes = await readFile(file);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = async () => {
        backgroundImage.value = img;

        // 等待 DOM 更新
        await nextTick();

        const canvas = canvasRef.value;
        if (canvas) {
          canvas.width = img.width;
          canvas.height = img.height;
          canvasSize.value = { width: img.width, height: img.height };

          // 清空预设模板选中值
          selectedPresetTemplate.value = null;

          // 自动应用模板布局
          applyTemplate(img.width, img.height);

          drawCanvas();
          message.success("图片上传成功");
        }
      };
      img.src = url;
    }
  } catch (error) {
    message.error("图片上传失败: " + error.message);
  }
};

// 绘制 Canvas
const drawCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (backgroundImage.value) {
    ctx.drawImage(backgroundImage.value, 0, 0, canvas.width, canvas.height);
  }

  // 绘制人脸图片
  if (faceImage.value) {
    ctx.drawImage(
      faceImage.value,
      facePosition.value.x,
      facePosition.value.y,
      facePosition.value.width,
      facePosition.value.height
    );

    // 绘制边框和调整手柄
    ctx.strokeStyle = '#1890ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      facePosition.value.x,
      facePosition.value.y,
      facePosition.value.width,
      facePosition.value.height
    );

    // 绘制四个角的调整手柄
    const handleSize = 8;
    ctx.fillStyle = '#1890ff';
    const corners = [
      { x: facePosition.value.x, y: facePosition.value.y }, // 左上
      { x: facePosition.value.x + facePosition.value.width, y: facePosition.value.y }, // 右上
      { x: facePosition.value.x, y: facePosition.value.y + facePosition.value.height }, // 左下
      { x: facePosition.value.x + facePosition.value.width, y: facePosition.value.y + facePosition.value.height }, // 右下
    ];
    corners.forEach(corner => {
      ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
    });
  }

  textFields.value.forEach((field) => {
    if (field.text) {
      // 优先使用字段自己的fontSize，否则使用全局fontSize
      const fontSize = field.fontSize || editorConfig.value.fontSize;
      ctx.font = `${fontSize}px ${editorConfig.value.fontFamily}`;

      // 处理多行文本
      if (field.multiline && field.text.includes('\n')) {
        const lines = field.text.split('\n');
        const lineHeight = fontSize * 1.2;
        lines.forEach((line, index) => {
          if (line) {
            const textWidth = ctx.measureText(line).width;
            const currentY = field.y + (index * lineHeight);
            // 绘制背景矩形
            ctx.fillStyle = editorConfig.value.backgroundColor;
            ctx.fillRect(field.x - 2, currentY - fontSize, textWidth + 4, fontSize + 4);
            // 绘制文本
            ctx.fillStyle = editorConfig.value.fontColor;
            ctx.fillText(line, field.x, currentY);
          }
        });
      } else {
        const textWidth = ctx.measureText(field.text).width;
        // 绘制背景矩形
        ctx.fillStyle = editorConfig.value.backgroundColor;
        ctx.fillRect(field.x - 2, field.y - fontSize, textWidth + 4, fontSize + 4);
        // 绘制文本
        ctx.fillStyle = editorConfig.value.fontColor;
        ctx.fillText(field.text, field.x, field.y);

        // 绘制选中框
        if (selectedField.value?.id === field.id) {
          ctx.save();
          ctx.strokeStyle = '#1890ff';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(field.x - 4, field.y - fontSize - 2, textWidth + 8, fontSize + 8);
          ctx.restore();
        }
      }
    }
  });
};

// 检测是否点击在调整手柄上
const getResizeHandle = (x, y) => {
  if (!faceImage.value) return null;
  const handleSize = 8;
  const tolerance = 5;
  const pos = facePosition.value;

  const handles = [
    { name: 'nw', x: pos.x, y: pos.y },
    { name: 'ne', x: pos.x + pos.width, y: pos.y },
    { name: 'sw', x: pos.x, y: pos.y + pos.height },
    { name: 'se', x: pos.x + pos.width, y: pos.y + pos.height },
  ];

  for (const handle of handles) {
    if (Math.abs(x - handle.x) <= handleSize / 2 + tolerance &&
        Math.abs(y - handle.y) <= handleSize / 2 + tolerance) {
      return handle.name;
    }
  }
  return null;
};

// 检测是否点击在人脸图片上
const isPointInFace = (x, y) => {
  if (!faceImage.value) return false;
  const pos = facePosition.value;
  return x >= pos.x && x <= pos.x + pos.width &&
         y >= pos.y && y <= pos.y + pos.height;
};

// 鼠标按下
const handleMouseDown = (e) => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // 优先检测人脸图片的调整手柄
  const handle = getResizeHandle(x, y);
  if (handle) {
    isResizingFace.value = true;
    faceResizeHandle.value = handle;
    faceStartPos.value = { x, y };
    return;
  }

  // 检测是否点击在人脸图片上
  if (isPointInFace(x, y)) {
    isDraggingFace.value = true;
    faceStartPos.value = {
      x: x - facePosition.value.x,
      y: y - facePosition.value.y
    };
    return;
  }

  // 检测文本字段
  const ctx = canvas.getContext("2d");
  selectedField.value = textFields.value.find((field) => {
    if (!field.text) return false;
    ctx.font = `${editorConfig.value.fontSize}px ${editorConfig.value.fontFamily}`;
    const textWidth = ctx.measureText(field.text).width;
    return (
      x >= field.x &&
      x <= field.x + textWidth &&
      y >= field.y - editorConfig.value.fontSize &&
      y <= field.y
    );
  });
  if (selectedField.value) {
    isDragging.value = true;
    dragOffset.value = { x: x - selectedField.value.x, y: y - selectedField.value.y };
  }
};

// 鼠标移动
const handleMouseMove = (e) => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // 处理人脸图片调整大小
  if (isResizingFace.value) {
    const dx = x - faceStartPos.value.x;
    const dy = y - faceStartPos.value.y;
    const pos = facePosition.value;
    const handle = faceResizeHandle.value;

    if (handle === 'se') {
      // 右下角：增加宽高
      facePosition.value.width = Math.max(50, pos.width + dx);
      facePosition.value.height = Math.max(50, pos.height + dy);
    } else if (handle === 'sw') {
      // 左下角：改变x和宽度，增加高度
      const newWidth = Math.max(50, pos.width - dx);
      facePosition.value.x = pos.x + (pos.width - newWidth);
      facePosition.value.width = newWidth;
      facePosition.value.height = Math.max(50, pos.height + dy);
    } else if (handle === 'ne') {
      // 右上角：增加宽度，改变y和高度
      facePosition.value.width = Math.max(50, pos.width + dx);
      const newHeight = Math.max(50, pos.height - dy);
      facePosition.value.y = pos.y + (pos.height - newHeight);
      facePosition.value.height = newHeight;
    } else if (handle === 'nw') {
      // 左上角：改变x和宽度，改变y和高度
      const newWidth = Math.max(50, pos.width - dx);
      const newHeight = Math.max(50, pos.height - dy);
      facePosition.value.x = pos.x + (pos.width - newWidth);
      facePosition.value.y = pos.y + (pos.height - newHeight);
      facePosition.value.width = newWidth;
      facePosition.value.height = newHeight;
    }

    faceStartPos.value = { x, y };
    drawCanvas();
    return;
  }

  // 处理人脸图片拖动
  if (isDraggingFace.value) {
    facePosition.value.x = x - faceStartPos.value.x;
    facePosition.value.y = y - faceStartPos.value.y;
    drawCanvas();
    return;
  }

  // 处理文本字段拖动
  if (isDragging.value) {
    selectedField.value.x = x - dragOffset.value.x;
    selectedField.value.y = y - dragOffset.value.y;
    drawCanvas();
  }
};

// 鼠标释放
const handleMouseUp = () => {
  isDragging.value = false;
  isDraggingFace.value = false;
  isResizingFace.value = false;
  // selectedField.value = null; // 保持选中状态，方便调整属性
  faceResizeHandle.value = null;
};

// 清空表单内容
const clearForm = () => {
  // 清空所有文本字段
  textFields.value.forEach(field => {
    field.text = "";
    field.fontSize = null;
  });

  // 重置字体设置为默认值
  editorConfig.value.fontSize = 36;
  editorConfig.value.fontColor = "#000000";
  editorConfig.value.fontFamily = "SimSun";
  editorConfig.value.backgroundColor = "#ffffff";

  // 重绘画布
  drawCanvas();

  message.success("已清空所有表单内容");
};

// 绘制最终图片（不含边框和手柄）
const drawFinalCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制背景图片
  if (backgroundImage.value) {
    ctx.drawImage(backgroundImage.value, 0, 0, canvas.width, canvas.height);
  }

  // 绘制人脸图片（不含边框）
  if (faceImage.value) {
    ctx.drawImage(
      faceImage.value,
      facePosition.value.x,
      facePosition.value.y,
      facePosition.value.width,
      facePosition.value.height
    );
  }

  // 绘制文本字段
  textFields.value.forEach((field) => {
    if (field.text) {
      const fontSize = field.fontSize || editorConfig.value.fontSize;
      ctx.font = `${fontSize}px ${editorConfig.value.fontFamily}`;

      if (field.multiline && field.text.includes('\n')) {
        const lines = field.text.split('\n');
        const lineHeight = fontSize * 1.2;
        lines.forEach((line, index) => {
          if (line) {
            const textWidth = ctx.measureText(line).width;
            const currentY = field.y + (index * lineHeight);
            ctx.fillStyle = editorConfig.value.backgroundColor;
            ctx.fillRect(field.x - 2, currentY - fontSize, textWidth + 4, fontSize + 4);
            ctx.fillStyle = editorConfig.value.fontColor;
            ctx.fillText(line, field.x, currentY);
          }
        });
      } else {
        const textWidth = ctx.measureText(field.text).width;
        ctx.fillStyle = editorConfig.value.backgroundColor;
        ctx.fillRect(field.x - 2, field.y - fontSize, textWidth + 4, fontSize + 4);
        ctx.fillStyle = editorConfig.value.fontColor;
        ctx.fillText(field.text, field.x, field.y);
      }
    }
  });
};

// 保存图片
const saveImage = async () => {
  const canvas = canvasRef.value;
  if (!canvas || !backgroundImage.value) {
    message.warning("请先上传图片");
    return;
  }
  try {
    // 先绘制不含边框的最终图片
    drawFinalCanvas();

    const desktop = (await homeDir()) + "Desktop/";
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const filePath = await save({
      defaultPath: `${desktop}身份证_${timestamp}.png`,
      filters: [{ name: "Image", extensions: ["png"] }],
    });
    if (filePath) {
      canvas.toBlob(async (blob) => {
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        await writeFile(filePath, bytes);

        // 保存后恢复带边框的显示
        drawCanvas();

        message.success("图片已保存到桌面");
      }, "image/png");
    } else {
      // 用户取消保存，恢复带边框的显示
      drawCanvas();
    }
  } catch (error) {
    // 出错时也恢复带边框的显示
    drawCanvas();
    message.error("保存失败: " + error.message);
  }
};

// 监听选中字段变化，自动滚动到对应配置项
watch(selectedField, (newVal) => {
  drawCanvas();
  if (newVal) {
    nextTick(() => {
      const el = document.getElementById(`field-item-${newVal.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
});

// 监听 Tab 切换
watch(activeTab, async (val) => {
  if (val === 'editor') {
    await nextTick();
    if (backgroundImage.value && canvasRef.value) {
      const canvas = canvasRef.value;
      if (canvasSize.value.width > 0 && canvasSize.value.height > 0) {
        canvas.width = canvasSize.value.width;
        canvas.height = canvasSize.value.height;
      }
      drawCanvas();
    }
  } else {
    // 离开编辑器时重置选中状态
    selectedField.value = null;
    isDragging.value = false;
    isDraggingFace.value = false;
    isResizingFace.value = false;
  }
});
</script>

<template>
  <div class="idcard-view">
    <div class="main-container">
      <div class="header-section">
        <div class="title-group">
          <div class="icon-wrapper">
            <IdcardOutlined />
          </div>
          <div class="title-text">
            <h2>证件号码生成</h2>
            <p>支持生成多种证件号码，仅供测试开发使用</p>
          </div>
        </div>
      </div>

      <div class="content-wrapper">
        <div class="left-panel">
          <div class="nav-menu">
            <div
              class="nav-item"
              :class="{ active: activeTab === 'idcard' }"
              @click="activeTab = 'idcard'"
            >
              <UserOutlined />
              <span>身份证</span>
            </div>
            <div
              class="nav-item"
              :class="{ active: activeTab === 'residence' }"
              @click="activeTab = 'residence'"
            >
              <CreditCardOutlined />
              <span>居住证</span>
            </div>
            <div
              class="nav-item"
              :class="{ active: activeTab === 'permit' }"
              @click="activeTab = 'permit'"
            >
              <SafetyCertificateOutlined />
              <span>通行证</span>
            </div>
            <div
              class="nav-item"
              :class="{ active: activeTab === 'permanent' }"
              @click="activeTab = 'permanent'"
            >
              <GlobalOutlined />
              <span>永居证</span>
            </div>
            <div
              class="nav-item"
              :class="{ active: activeTab === 'editor' }"
              @click="activeTab = 'editor'"
            >
              <PictureOutlined />
              <span>证件编辑器</span>
            </div>
          </div>

          <div class="config-container">
            <div class="config-panel" v-if="activeTab === 'idcard'">
              <a-form layout="vertical" class="config-form">
                <a-row :gutter="12">
                  <a-col :span="24">
                    <a-form-item label="地区">
                      <a-select
                        v-model:value="idcardConfig.region"
                        :options="regions"
                        show-search
                        placeholder="选择地区"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="出生年份">
                      <a-select
                        v-model:value="idcardConfig.birthYear"
                        :options="yearOptions"
                        show-search
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="日期 (月/日)">
                      <div style="display: flex; gap: 8px">
                        <a-select
                          v-model:value="idcardConfig.birthMonth"
                          :options="monthOptions"
                          placeholder="月"
                          style="flex: 1"
                        />
                        <a-select
                          v-model:value="idcardConfig.birthDay"
                          :options="dayOptions"
                          placeholder="日"
                          style="flex: 1"
                        />
                      </div>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="性别">
                      <a-select
                        v-model:value="idcardConfig.gender"
                        :options="[
                          { value: 'male', label: '男' },
                          { value: 'female', label: '女' },
                        ]"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="生成数量">
                      <a-select
                        v-model:value="idcardConfig.count"
                        :options="countOptions"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-form>
            </div>

            <div class="config-panel" v-if="activeTab === 'permanent'">
              <a-form layout="vertical" class="config-form">
                <a-row :gutter="12">
                  <a-col :span="24">
                    <a-form-item label="版本">
                      <a-radio-group
                        v-model:value="permanentConfig.version"
                        button-style="solid"
                        style="width: 100%; display: flex"
                      >
                        <a-radio-button
                          value="new"
                          style="flex: 1; text-align: center"
                          >新版五星卡 (18位)</a-radio-button
                        >
                        <a-radio-button
                          value="old"
                          style="flex: 1; text-align: center"
                          >旧版 (15位)</a-radio-button
                        >
                      </a-radio-group>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="出生年份">
                      <a-select
                        v-model:value="permanentConfig.birthYear"
                        :options="yearOptions"
                        show-search
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="日期 (月/日)">
                      <div style="display: flex; gap: 8px">
                        <a-select
                          v-model:value="permanentConfig.birthMonth"
                          :options="monthOptions"
                          placeholder="月"
                          style="flex: 1"
                        />
                        <a-select
                          v-model:value="permanentConfig.birthDay"
                          :options="dayOptions"
                          placeholder="日"
                          style="flex: 1"
                        />
                      </div>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12" v-if="permanentConfig.version === 'new'">
                    <a-form-item label="性别">
                      <a-select
                        v-model:value="permanentConfig.gender"
                        :options="[
                          { value: 'male', label: '男' },
                          { value: 'female', label: '女' },
                        ]"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="permanentConfig.version === 'new' ? 12 : 24">
                    <a-form-item label="生成数量">
                      <a-select
                        v-model:value="permanentConfig.count"
                        :options="countOptions"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-form>
            </div>

            <div class="config-panel" v-if="activeTab === 'permit'">
              <a-form layout="vertical" class="config-form">
                <a-row :gutter="12">
                  <a-col :span="24">
                    <a-form-item label="地区类型">
                      <a-radio-group
                        v-model:value="permitConfig.type"
                        button-style="solid"
                        style="display: flex"
                      >
                        <a-radio-button
                          value="HK"
                          style="flex: 1; text-align: center"
                          >🇭🇰 香港</a-radio-button
                        >
                        <a-radio-button
                          value="MO"
                          style="flex: 1; text-align: center"
                          >🇲🇴 澳门</a-radio-button
                        >
                        <a-radio-button
                          value="TW"
                          style="flex: 1; text-align: center"
                          >🇹🇼 台湾</a-radio-button
                        >
                      </a-radio-group>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="24">
                    <a-form-item label="生成数量">
                      <a-select
                        v-model:value="permitConfig.count"
                        :options="countOptions"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-form>
            </div>

            <div class="config-panel" v-if="activeTab === 'residence'">
              <a-form layout="vertical" class="config-form">
                <a-row :gutter="12">
                  <a-col :span="24">
                    <a-form-item
                      label=""
                    >
                      <a-radio-group
                        v-model:value="residenceConfig.type"
                        button-style="solid"
                        style="display: flex; width: 100%"
                      >
                        <a-radio-button
                          value="HK"
                          style="flex: 1; text-align: center"
                          >🇭🇰 香港</a-radio-button
                        >
                        <a-radio-button
                          value="MO"
                          style="flex: 1; text-align: center"
                          >🇲🇴 澳门</a-radio-button
                        >
                        <a-radio-button
                          value="TW"
                          style="flex: 1; text-align: center"
                          >🇹🇼 台湾</a-radio-button
                        >
                      </a-radio-group>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="出生年份">
                      <a-select
                        v-model:value="residenceConfig.birthYear"
                        :options="yearOptions"
                        show-search
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="日期 (月/日)">
                      <div style="display: flex; gap: 8px">
                        <a-select
                          v-model:value="residenceConfig.birthMonth"
                          :options="monthOptions"
                          placeholder="月"
                          style="flex: 1"
                        />
                        <a-select
                          v-model:value="residenceConfig.birthDay"
                          :options="dayOptions"
                          placeholder="日"
                          style="flex: 1"
                        />
                      </div>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="性别">
                      <a-select
                        v-model:value="residenceConfig.gender"
                        :options="[
                          { value: 'male', label: '男' },
                          { value: 'female', label: '女' },
                        ]"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="生成数量">
                      <a-select
                        v-model:value="residenceConfig.count"
                        :options="countOptions"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-form>
            </div>

            <div class="config-panel" v-if="activeTab === 'editor'">
              <a-form layout="vertical" class="config-form">
                <a-collapse v-model:activeKey="activeCollapseKeys" ghost>
                  <a-collapse-panel key="1" header="图片设置">
                    <a-row :gutter="12">
                      <a-col :span="12">
                        <a-form-item>
                          <a-button type="primary" @click="uploadImage" block>
                            <template #icon><UploadOutlined /></template>
                            上传证件
                          </a-button>
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <a-form-item>
                          <a-button @click="uploadFaceImage" block>
                            <template #icon><UserOutlined /></template>
                            上传人脸
                          </a-button>
                        </a-form-item>
                      </a-col>
                    </a-row>
                    
                    <a-form-item label="预设模板">
                      <a-select
                        v-model:value="selectedPresetTemplate"
                        :options="presetTemplates"
                        placeholder="选择预设证件图片模板"
                        @change="loadPresetTemplate"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-collapse-panel>

                  <a-collapse-panel key="2" header="字段内容">
                    <div
                      v-for="field in textFields"
                      :key="field.id"
                      :id="`field-item-${field.id}`"
                      class="field-item-container field-card-edit"
                      :class="{ active: selectedField?.id === field.id }"
                    >
                      <a-form-item :label="field.label" style="margin-bottom: 0">
                        <div style="display: flex; gap: 8px; align-items: flex-start;">
                          <a-textarea
                            v-if="field.multiline"
                            v-model:value="field.text"
                            @input="drawCanvas"
                            @focus="selectedField = field"
                            :rows="2"
                            style="flex: 1;"
                          />
                          <a-input
                            v-else
                            v-model:value="field.text"
                            @input="drawCanvas"
                            @focus="selectedField = field"
                            style="flex: 1;"
                          />
                          <a-input-number
                            v-model:value="field.fontSize"
                            :min="12"
                            :max="100"
                            :step="1"
                            @change="drawCanvas"
                            @focus="selectedField = field"
                            style="width: 80px;"
                            placeholder="字号"
                          >
                            <template #prefix>T</template>
                          </a-input-number>
                        </div>
                      </a-form-item>
                    </div>
                  </a-collapse-panel>

                  <a-collapse-panel key="3" header="全局样式">
                    <a-row :gutter="12">
                      <a-col :span="24">
                        <a-form-item label="全局字号">
                          <a-slider v-model:value="editorConfig.fontSize" :min="10" :max="80" @change="drawCanvas" />
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <a-form-item label="字体颜色">
                          <div class="color-picker-wrapper">
                            <input type="color" v-model="editorConfig.fontColor" @input="drawCanvas" />
                            <span>{{ editorConfig.fontColor }}</span>
                          </div>
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <a-form-item label="背景颜色">
                          <div class="color-picker-wrapper">
                            <input type="color" v-model="editorConfig.backgroundColor" @input="drawCanvas" />
                            <span>{{ editorConfig.backgroundColor }}</span>
                          </div>
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </a-collapse-panel>
                </a-collapse>

                <div style="padding: 0 16px">
                  <a-popconfirm
                    title="确定要清空所有表单内容吗？"
                    ok-text="确定"
                    cancel-text="取消"
                    @confirm="clearForm"
                  >
                    <a-button danger block>
                      <template #icon><DeleteOutlined /></template>
                      一键清空表单
                    </a-button>
                  </a-popconfirm>
                </div>
              </a-form>
            </div>

            <div class="action-bar">
              <a-button
                v-if="activeTab !== 'editor'"
                type="primary"
                size="large"
                @click="handleGenerate"
                :loading="generating"
                block
                class="generate-btn"
              >
                <template #icon><ReloadOutlined /></template>
                立即生成
              </a-button>
              <a-button
                v-else
                type="primary"
                size="large"
                @click="saveImage"
                block
                class="generate-btn"
              >
                <template #icon><DownloadOutlined /></template>
                保存到桌面
              </a-button>
            </div>
          </div>
        </div>

        <div class="right-panel">
          <div class="results-header">
            <span class="results-title">
              <template v-if="activeTab === 'editor'">证件预览</template>
              <template v-else>
                生成结果
                <span class="count-badge" v-if="results.length">{{
                  results.length
                }}</span>
                <a-tag
                  v-if="results.length"
                  color="blue"
                  style="margin-left: 8px"
                  >{{ results[0].type }}</a-tag
                >
              </template>
            </span>
            <div class="header-actions" v-if="results.length && activeTab !== 'editor'">
              <a-button size="small" @click="exportToTxt">
                <template #icon><DownloadOutlined /></template>
                导出TXT
              </a-button>
              <a-button size="small" @click="copyAll">
                <template #icon><CopyOutlined /></template>
                复制全部
              </a-button>
            </div>
          </div>

          <div class="results-scroll-area">
            <div v-if="activeTab === 'editor'" class="canvas-container">
              <canvas
                v-show="backgroundImage"
                ref="canvasRef"
                @mousedown="handleMouseDown"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                style="max-width: 100%; cursor: move; border: 1px solid #e0e0e0; border-radius: 8px;"
              ></canvas>
              <div v-if="!backgroundImage" class="empty-state">
                <div class="empty-icon-wrapper">
                  <PictureOutlined />
                </div>
                <h3>等待上传</h3>
                <p>请点击左侧"上传证件图片"按钮</p>
              </div>
            </div>
            <TransitionGroup
              v-else-if="results.length > 0"
              name="list"
              tag="div"
              class="results-list"
            >
              <div v-for="item in results" :key="item.id" class="result-item">
                <div class="result-content">
                  <div class="result-row">
                    <div class="result-number">{{ item.number }}</div>
                    <div class="result-type-tag">{{ item.type }}</div>
                  </div>
                  <div class="result-info">{{ item.info }}</div>
                </div>
                <div class="result-actions">
                  <a-tooltip title="复制">
                    <a-button
                      type="text"
                      class="action-btn"
                      @click="copyItem(item.number)"
                    >
                      <CopyOutlined />
                    </a-button>
                  </a-tooltip>
                </div>
              </div>
            </TransitionGroup>

            <div v-else class="empty-state">
              <div class="empty-icon-wrapper">
                <IdcardOutlined />
              </div>
              <h3>等待生成</h3>
              <p>请在左侧配置参数并点击生成按钮</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-group {
  display: flex;
}
.title-group .title-text {
  margin-left: 10px;
}
.idcard-view {
  height: 100%;
  padding: 24px;
  background: var(--bg-color);
  overflow: hidden;
}

.main-container {
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header */
.header-section {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 8px;
}

.icon-wrapper {
  width: 44px;
  height: 44px;
  background: var(--primary-gradient);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.title-text h2 {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
  line-height: 1.2;
}

.title-text p {
  margin: 2px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* Content Layout */
.content-wrapper {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
}

/* Left Panel */
.left-panel {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
}

.nav-menu {
  background: #fff;
  border-radius: 16px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--border-color);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  font-weight: 500;
  font-size: 14px;
}

.nav-item:hover {
  background: #f1f5f9;
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--primary-light);
  color: var(--primary-color);
}

.nav-item .anticon {
  font-size: 16px;
}

.config-container {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.config-panel {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.config-form :deep(.ant-form-item) {
  margin-bottom: 18px;
}

.config-form :deep(.ant-form-item-label > label) {
  font-size: 13px;
  color: var(--text-secondary);
}

.action-bar {
  /* margin-top: 24px; */
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.generate-btn {
  height: 42px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  background: var(--primary-gradient);
  border: none;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  transition: all 0.2s;
}

.generate-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
}

/* Right Panel */
.right-panel {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.results-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
}

.results-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.count-badge {
  background: var(--primary-light);
  color: var(--primary-color);
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.results-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f8fafc;
}

/* Canvas Container */
.canvas-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.canvas-container canvas {
  display: block;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Result List */
.results-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-item {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--border-color);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.result-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transform: translateY(-2px);
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.result-number {
  font-family: "JetBrains Mono", "SF Mono", "Consolas", monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.result-type-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: var(--text-tertiary);
  border: 1px solid var(--border-color);
}

.result-info {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.result-item:hover .result-actions {
  opacity: 1;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: #f8fafc;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--primary-light);
  color: var(--primary-color);
  border-color: rgba(59, 130, 246, 0.1);
}

/* Animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.list-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* Empty State */
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  min-height: 400px;
}

.empty-icon-wrapper {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  margin-bottom: 24px;
  color: #cbd5e1;
  border: 4px solid #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

/* Responsive */
@media (max-width: 960px) {
  .content-wrapper {
    flex-direction: column;
  }

  .left-panel {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .nav-menu {
    flex-direction: row;
    overflow-x: auto;
    width: 100%;
    padding: 6px;
  }

  .nav-item {
    flex: 1;
    justify-content: center;
    white-space: nowrap;
  }

  .config-container {
    width: 100%;
  }
}

@media (max-width: 600px) {
  .idcard-view {
    padding: 16px;
  }

  .nav-item span {
    display: none;
  }

  .nav-item {
    padding: 10px;
  }

  .result-item {
    padding: 14px;
  }

  .result-number {
    font-size: 15px;
  }
}
</style>

<style scoped>
  .field-card-edit .ant-form-item{
    margin-bottom: 0;
  }
/* Editor Specific Styles */
.config-form :deep(.ant-collapse-content-box) {
  padding: 12px 0;
}

.config-form :deep(.ant-collapse-header) {
  padding: 12px 0 !important;
  font-weight: 600;
  color: var(--text-primary) !important;
}

.field-item-container {
  padding: 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid transparent;
  margin-bottom: 12px;
  transition: all 0.3s;
}

.field-item-container.active {
  background: #e6f4ff;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.field-item-container:hover {
  background: #f1f5f9;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
}

.color-picker-wrapper input[type="color"] {
  width: 24px;
  height: 24px;
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
}

.color-picker-wrapper span {
  font-size: 12px;
  color: #666;
  font-family: monospace;
}
</style>
