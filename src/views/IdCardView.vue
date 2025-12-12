<script setup>
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  CopyOutlined,
  ReloadOutlined,
  IdcardOutlined,
  UserOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'

const activeTab = ref('idcard')
const generating = ref(false)

// 身份证配置
const idcardConfig = ref({
  region: '110000',
  birthYear: new Date().getFullYear() - 25,
  birthMonth: 1,
  birthDay: 1,
  gender: 'male',
  count: 10
})

// 永居证配置
const permanentConfig = ref({
  birthYear: new Date().getFullYear() - 30,
  birthMonth: 1,
  birthDay: 1,
  type: 'PRC',
  count: 10
})

// 港澳台通行证配置
const permitConfig = ref({
  type: 'HK',
  count: 10
})

// 港澳台居住证配置
const residenceConfig = ref({
  region: '110000',
  birthYear: new Date().getFullYear() - 25,
  birthMonth: 1,
  birthDay: 1,
  gender: 'male',
  type: 'HK',
  count: 10
})

const results = ref([])

// 地区码数据
const regions = [
  { value: '110000', label: '北京市' },
  { value: '120000', label: '天津市' },
  { value: '310000', label: '上海市' },
  { value: '500000', label: '重庆市' },
  { value: '130000', label: '河北省' },
  { value: '140000', label: '山西省' },
  { value: '210000', label: '辽宁省' },
  { value: '220000', label: '吉林省' },
  { value: '230000', label: '黑龙江省' },
  { value: '320000', label: '江苏省' },
  { value: '330000', label: '浙江省' },
  { value: '340000', label: '安徽省' },
  { value: '350000', label: '福建省' },
  { value: '360000', label: '江西省' },
  { value: '370000', label: '山东省' },
  { value: '410000', label: '河南省' },
  { value: '420000', label: '湖北省' },
  { value: '430000', label: '湖南省' },
  { value: '440000', label: '广东省' },
  { value: '450000', label: '广西壮族自治区' },
  { value: '460000', label: '海南省' },
  { value: '510000', label: '四川省' },
  { value: '520000', label: '贵州省' },
  { value: '530000', label: '云南省' },
  { value: '610000', label: '陕西省' },
  { value: '620000', label: '甘肃省' },
  { value: '640000', label: '宁夏回族自治区' },
  { value: '650000', label: '新疆维吾尔自治区' }
]

// 计算校验码
const calcCheckCode = (idcard17) => {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idcard17[i]) * weights[i]
  }
  return checkCodes[sum % 11]
}

// 计算永居证校验码（2位）
const calcPermanentCheckCode = (permanent13) => {
  let sum = 0
  for (let i = 0; i < permanent13.length; i++) {
    const char = permanent13[i]
    const value = char >= 'A' && char <= 'Z' ? char.charCodeAt(0) - 55 : parseInt(char)
    sum += value
  }
  return String(sum % 100).padStart(2, '0')
}

// 生成身份证
const generateIdCard = () => {
  const { region, birthYear, birthMonth, birthDay, gender, count } = idcardConfig.value
  const list = []

  for (let i = 0; i < count; i++) {
    const date = `${birthYear}${String(birthMonth).padStart(2, '0')}${String(birthDay).padStart(2, '0')}`
    const seq = String(Math.floor(Math.random() * 500) * 2 + (gender === 'male' ? 1 : 0)).padStart(3, '0')
    const id17 = region + date + seq
    const checkCode = calcCheckCode(id17)
    const idcard = id17 + checkCode

    const age = new Date().getFullYear() - birthYear
    const regionName = regions.find(r => r.value === region)?.label || '未知'

    list.push({
      id: Date.now() + i,
      number: idcard,
      type: '身份证',
      info: `${regionName} | ${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')} | ${gender === 'male' ? '男' : '女'} | ${age}岁`
    })
  }

  return list
}

// 生成永居证（15位格式：3位国家码+4位地区码+6位日期YYMMDD+2位校验码）
const generatePermanent = () => {
  const { birthYear, birthMonth, birthDay, type, count } = permanentConfig.value
  const list = []
  const typeMap = {
    PRC: { name: '外国人', code: 'CHN' },
    HKM: { name: '港澳', code: 'HKM' },
    TWN: { name: '台湾', code: 'TWN' },
    GBR: { name: '英国', code: 'GBR' },
    USA: { name: '美国', code: 'USA' },
    JPN: { name: '日本', code: 'JPN' }
  }

  for (let i = 0; i < count; i++) {
    const countryCode = typeMap[type]?.code || 'CHN'
    const regionCode = String(Math.floor(Math.random() * 9000) + 1000)
    const yearShort = String(birthYear).slice(-2)
    const dateCode = `${yearShort}${String(birthMonth).padStart(2, '0')}${String(birthDay).padStart(2, '0')}`
    const permanent13 = `${countryCode}${regionCode}${dateCode}`
    const checkCode = calcPermanentCheckCode(permanent13)
    const number = permanent13 + checkCode

    const age = new Date().getFullYear() - birthYear

    list.push({
      id: Date.now() + i,
      number,
      type: '永久居留证',
      info: `${typeMap[type]?.name || '未知'} | ${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')} | ${age}岁`
    })
  }

  return list
}

// 生成港澳台通行证
const generatePermit = () => {
  const { type, count } = permitConfig.value
  const list = []
  const typeMap = { HK: '香港', MO: '澳门', TW: '台湾' }

  for (let i = 0; i < count; i++) {
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26))
    const seq = String(Math.floor(Math.random() * 90000000) + 10000000)
    const number = `${letter}${seq}`

    list.push({
      id: Date.now() + i,
      number,
      type: `${typeMap[type]}通行证`,
      info: `地区: ${typeMap[type]}`
    })
  }

  return list
}

// 生成港澳台居住证
const generateResidence = () => {
  const { region, birthYear, birthMonth, birthDay, gender, type, count } = residenceConfig.value
  const list = []
  const typeMap = { HK: '香港', MO: '澳门', TW: '台湾' }

  for (let i = 0; i < count; i++) {
    const date = `${birthYear}${String(birthMonth).padStart(2, '0')}${String(birthDay).padStart(2, '0')}`
    const seq = String(Math.floor(Math.random() * 500) * 2 + (gender === 'male' ? 1 : 0)).padStart(3, '0')
    const id17 = region + date + seq
    const checkCode = calcCheckCode(id17)
    const number = id17 + checkCode

    const age = new Date().getFullYear() - birthYear
    const regionName = regions.find(r => r.value === region)?.label || '未知'

    list.push({
      id: Date.now() + i,
      number,
      type: `${typeMap[type]}居住证`,
      info: `${regionName} | ${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')} | ${gender === 'male' ? '男' : '女'} | ${age}岁`
    })
  }

  return list
}

// 生成证件
const handleGenerate = () => {
  generating.value = true

  setTimeout(() => {
    if (activeTab.value === 'idcard') {
      results.value = generateIdCard()
    } else if (activeTab.value === 'permanent') {
      results.value = generatePermanent()
    } else if (activeTab.value === 'permit') {
      results.value = generatePermit()
    } else if (activeTab.value === 'residence') {
      results.value = generateResidence()
    }

    generating.value = false
    message.success(`已生成 ${results.value.length} 条记录`)
  }, 300)
}

// 复制单条
const copyItem = (number) => {
  navigator.clipboard.writeText(number)
  message.success('已复制到剪贴板')
}

// 批量复制
const copyAll = () => {
  const text = results.value.map(r => r.number).join('\n')
  navigator.clipboard.writeText(text)
  message.success(`已复制 ${results.value.length} 条记录`)
}

// 清空结果
const clearResults = () => {
  results.value = []
  message.info('已清空结果')
}

const yearOptions = computed(() => {
  const current = new Date().getFullYear()
  return Array.from({ length: 100 }, (_, i) => ({
    value: current - i,
    label: `${current - i}年`
  }))
})
const monthOptions = computed(() => {
  return Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}月`
  }))
})

const dayOptions = computed(() => {
  return Array.from({ length: 31 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}日`
  }))
})
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

      <div class="content-body">
        <div class="config-wrapper">
          <a-tabs v-model:activeKey="activeTab" class="custom-tabs" type="card" :animated="true">
            <a-tab-pane key="idcard">
              <template #tab>
                <span class="tab-label">
                  <UserOutlined />
                  身份证
                </span>
              </template>
              <div class="config-panel">
                <a-form layout="vertical" class="config-form">
                  <a-row :gutter="12">
                    <a-col :span="24">
                      <a-form-item label="地区">
                        <a-select v-model:value="idcardConfig.region" :options="regions" show-search placeholder="选择地区" style="width: 100%" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row :gutter="12">
                    <a-col :span="12">
                      <a-form-item label="出生年份">
                        <a-select v-model:value="idcardConfig.birthYear" :options="yearOptions" show-search style="width: 100%" />
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
                    <a-col :span="24">
                      <a-form-item label="性别">
                        <a-radio-group v-model:value="idcardConfig.gender" button-style="solid" style="width: 100%; display: flex;">
                          <a-radio-button value="male" style="flex: 1; text-align: center;">男</a-radio-button>
                          <a-radio-button value="female" style="flex: 1; text-align: center;">女</a-radio-button>
                        </a-radio-group>
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row :gutter="12">
                    <a-col :span="24">
                      <a-form-item label="生成数量">
                         <a-slider v-model:value="idcardConfig.count" :min="1" :max="50" :marks="{1:'1', 10:'10', 50:'50'}" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </a-form>
              </div>
            </a-tab-pane>

            <a-tab-pane key="permanent">
              <template #tab>
                <span class="tab-label">
                  <GlobalOutlined />
                  永久居留证
                </span>
              </template>
              <div class="config-panel">
                <a-form layout="vertical" class="config-form">
                  <a-row :gutter="12">
                    <a-col :span="24">
                      <a-form-item label="国家/地区">
                        <a-select v-model:value="permanentConfig.type" style="width: 100%">
                          <a-select-option value="GBR">🇬🇧 英国 (GBR)</a-select-option>
                          <a-select-option value="USA">🇺🇸 美国 (USA)</a-select-option>
                          <a-select-option value="JPN">🇯🇵 日本 (JPN)</a-select-option>
                          <a-select-option value="PRC">🇨🇳 中国 (CHN)</a-select-option>
                          <a-select-option value="HKM">🇭🇰 港澳 (HKM)</a-select-option>
                          <a-select-option value="TWN">🇹🇼 台湾 (TWN)</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row :gutter="12">
                    <a-col :span="12">
                      <a-form-item label="出生年份">
                        <a-select v-model:value="permanentConfig.birthYear" :options="yearOptions" show-search style="width: 100%" />
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
                     <a-col :span="24">
                      <a-form-item label="数量">
                        <a-input-number v-model:value="permanentConfig.count" :min="1" :max="100" style="width: 100%" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </a-form>
              </div>
            </a-tab-pane>

            <a-tab-pane key="permit">
               <template #tab>
                <span class="tab-label">
                  <SafetyCertificateOutlined />
                  通行证
                </span>
              </template>
              <div class="config-panel">
                <a-form layout="vertical" class="config-form">
                  <a-row :gutter="12">
                    <a-col :span="24">
                      <a-form-item label="地区类型">
                        <a-radio-group v-model:value="permitConfig.type" button-style="solid" style="display: flex">
                          <a-radio-button value="HK" style="flex: 1; text-align: center">🇭🇰 香港</a-radio-button>
                          <a-radio-button value="MO" style="flex: 1; text-align: center">🇲🇴 澳门</a-radio-button>
                          <a-radio-button value="TW" style="flex: 1; text-align: center">🇹🇼 台湾</a-radio-button>
                        </a-radio-group>
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row :gutter="12">
                    <a-col :span="24">
                      <a-form-item label="生成数量">
                         <a-input-number v-model:value="permitConfig.count" :min="1" :max="100" style="width: 100%" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </a-form>
              </div>
            </a-tab-pane>

            <a-tab-pane key="residence">
               <template #tab>
                <span class="tab-label">
                  <CreditCardOutlined />
                  居住证
                </span>
              </template>
              <div class="config-panel">
                <a-form layout="vertical" class="config-form">
                  <a-row :gutter="12">
                    <a-col :span="12">
                       <a-form-item label="来源地">
                        <a-select v-model:value="residenceConfig.type">
                          <a-select-option value="HK">🇭🇰 香港</a-select-option>
                          <a-select-option value="MO">🇲🇴 澳门</a-select-option>
                          <a-select-option value="TW">🇹🇼 台湾</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                    <a-col :span="12">
                      <a-form-item label="居住地">
                        <a-select v-model:value="residenceConfig.region" :options="regions" show-search />
                      </a-form-item>
                    </a-col>
                  </a-row>
                    <a-row :gutter="12">
                      <a-col :span="12">
                        <a-form-item label="出生年份">
                          <a-select v-model:value="residenceConfig.birthYear" :options="yearOptions" show-search />
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
                        <a-radio-group v-model:value="residenceConfig.gender" button-style="solid" style="display: flex; width: 100%">
                          <a-radio-button value="male" style="flex: 1; text-align: center">男</a-radio-button>
                          <a-radio-button value="female" style="flex: 1; text-align: center">女</a-radio-button>
                        </a-radio-group>
                      </a-form-item>
                    </a-col>
                    <a-col :span="12">
                      <a-form-item label="数量">
                        <a-input-number v-model:value="residenceConfig.count" :min="1" :max="100" style="width: 100%" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </a-form>
              </div>
            </a-tab-pane>
          </a-tabs>

          <div class="action-bar">
            <a-button type="primary" size="large" @click="handleGenerate" :loading="generating" block class="generate-btn">
              <template #icon><ReloadOutlined /></template>
              立即生成证件号码
            </a-button>
          </div>
        </div>

        <div class="results-container">
           <div class="results-header">
              <span class="results-title">生成结果 <span class="count-badge" v-if="results.length">{{ results.length }}</span></span>
              <div class="header-actions" v-if="results.length">
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
              <TransitionGroup name="list" tag="div" class="results-list" v-if="results.length > 0">
                <div v-for="item in results" :key="item.id" class="result-item">
                  <div class="item-icon">
                    <IdcardOutlined />
                  </div>
                  <div class="result-content">
                    <div class="result-number">{{ item.number }}</div>
                    <div class="result-info">{{ item.info }}</div>
                  </div>
                  <a-tooltip title="复制">
                    <a-button type="text" class="copy-btn" @click="copyItem(item.number)">
                      <CopyOutlined />
                    </a-button>
                  </a-tooltip>
                </div>
              </TransitionGroup>
              
              <div v-else class="empty-state">
                <div class="empty-image">
                  <IdcardOutlined />
                </div>
                <h3>等待生成</h3>
                <p>请在上方配置参数并点击生成按钮</p>
              </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.idcard-view {
  height: 100%;
  padding: 16px;
  background: var(--bg-color);
}

.main-container {
  max-width: 1600px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Header */
.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-wrapper {
  width: 48px;
  height: 48px;
  background: var(--primary-gradient);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.title-text h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.title-text p {
  margin: 2px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* Content Layout */
.content-body {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
  flex: 1;
  min-height: 0; /* Important for scroll */
}

/* Config Panel */
.config-wrapper {
  background: #fff;
  border-radius: var(--border-radius-lg);
  padding: 20px;
  box-shadow: var(--box-shadow);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
}

.custom-tabs {
  flex: 1;
}

.custom-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 20px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.config-panel {
  padding: 8px 4px;
}

.generate-btn {
  margin-top: auto;
  height: 44px;
  font-size: 16px;
  background: var(--primary-gradient);
  border: none;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}

.generate-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

/* Results Panel */
.results-container {
  background: #fff;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--box-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.results-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(248, 250, 252, 0.5);
}

.results-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: var(--primary-color);
  color: #fff;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: normal;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.results-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8fafc;
}

/* List Transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.list-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.result-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  border: 1px solid transparent;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.result-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--primary-color);
  opacity: 0;
  transition: opacity 0.2s;
}

.result-item:hover {
  transform: translateX(4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.06);
  border-color: rgba(59, 130, 246, 0.2);
}

.result-item:hover::before {
  opacity: 1;
}

.item-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #eff6ff;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
}

.result-content {
  flex: 1;
}

.result-number {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.result-info {
  font-size: 13px;
  color: var(--text-tertiary);
}

.copy-btn {
  opacity: 0;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.result-item:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  color: var(--primary-color);
  background: #eff6ff;
}

/* Empty State */
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  min-height: 300px;
}

.empty-image {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: 16px;
  color: #cbd5e1;
}

.empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

/* Responsive adjustments */
@media (max-width: 900px) {
  .content-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  
  .config-wrapper {
    min-height: auto;
  }

  .results-container {
    min-height: 400px;
  }
}

@media (max-width: 600px) {
  .idcard-view {
    padding: 12px;
  }
  
  .header-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .result-number {
    font-size: 16px;
  }
}
</style>
