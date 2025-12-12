<script setup>
import { ref, computed } from "vue";
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
} from "@ant-design/icons-vue";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
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
        "9" + String(Math.floor(Math.random() * 90000) + 10000).substring(1); // 9xxxxx
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

// 清空结果
const clearResults = () => {
  results.value = [];
  message.info("已清空结果");
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
              <span>居民身份证</span>
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
              <span>永久居留证</span>
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
                      label="来源地 (前6位固定: 香港810000 澳门820000 台湾830000)"
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

            <div class="action-bar">
              <a-button
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
            </div>
          </div>
        </div>

        <div class="right-panel">
          <div class="results-header">
            <span class="results-title"
              >生成结果
              <span class="count-badge" v-if="results.length">{{
                results.length
              }}</span>
              <a-tag
                v-if="results.length"
                color="blue"
                style="margin-left: 8px"
                >{{ results[0].type }}</a-tag
              ></span
            >
            <div class="header-actions" v-if="results.length">
              <a-button size="small" @click="exportToTxt">
                <template #icon><DownloadOutlined /></template>
                导出TXT
              </a-button>
              <a-button size="small" @click="copyAll">
                <template #icon><CopyOutlined /></template>
                复制全部
              </a-button>
              <a-button size="small" danger @click="clearResults">
                <template #icon><DeleteOutlined /></template>
                清空
              </a-button>
            </div>
          </div>

          <div class="results-scroll-area">
            <TransitionGroup
              name="list"
              tag="div"
              class="results-list"
              v-if="results.length > 0"
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
  width: 340px;
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
  padding: 24px;
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
  margin-top: 24px;
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
