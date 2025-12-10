<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { message } from 'ant-design-vue'
import { Store } from '@tauri-apps/plugin-store'
import {
  PlayCircleOutlined,
  StopOutlined,
  PauseCircleOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  DeleteOutlined,
  DownOutlined,
  UpOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  VideoCameraOutlined,
  EllipsisOutlined
} from '@ant-design/icons-vue'

// Store 实例
let settingsStore = null
let sessionsStore = null

// 录制状态
const isRecording = ref(false)
const isPlaying = ref(false)
const recordingTime = ref(0)
let recordingTimer = null
let statusTimer = null

// 倒计时配置
const countdownEnabled = ref(true)
const countdownSeconds = ref(3)
const isCountingDown = ref(false)
const currentCountdown = ref(0)

// 执行延迟配置
const executeDelayEnabled = ref(false)
const executeDelaySeconds = ref(3)
const isExecuteDelaying = ref(false)
const currentExecuteDelay = ref(0)

// 回放配置
const repeatCount = ref(1)
const isInfinite = ref(false)

// 录制会话管理
const recordingSessions = ref([])
const expandedSessions = ref(new Set())
const editingSessionId = ref(null)
const editingRemark = ref('')

// 事件详情表格列定义
const columns = [
  { title: '序号', dataIndex: 'index', key: 'index', width: 80 },
  { title: '事件类型', dataIndex: 'event_type', key: 'event_type', width: 150 },
  { title: '详情', dataIndex: 'details', key: 'details' },
  { title: '时间戳 (ms)', dataIndex: 'timestamp', key: 'timestamp', width: 150 },
]

// 倒计时功能
const startCountdown = () => {
  return new Promise((resolve) => {
    isCountingDown.value = true
    currentCountdown.value = countdownSeconds.value

    const countdownTimer = setInterval(() => {
      currentCountdown.value--

      if (currentCountdown.value <= 0) {
        clearInterval(countdownTimer)
        isCountingDown.value = false
        resolve()
      }
    }, 1000)
  })
}

// 执行延迟倒计时功能
const startExecuteDelay = () => {
  return new Promise((resolve) => {
    isExecuteDelaying.value = true
    currentExecuteDelay.value = executeDelaySeconds.value

    const delayTimer = setInterval(() => {
      currentExecuteDelay.value--

      if (currentExecuteDelay.value <= 0) {
        clearInterval(delayTimer)
        isExecuteDelaying.value = false
        resolve()
      }
    }, 1000)
  })
}

const startRecording = async () => {
  try {
    if (countdownEnabled.value) {
      await startCountdown()
    }

    await invoke('start_record')
    isRecording.value = true
    recordingTime.value = 0
    recordingTimer = setInterval(() => {
      recordingTime.value++
    }, 1000)

    message.success('开始录制')
  } catch (error) {
    message.error(error)
  }
}

const stopRecording = async () => {
  try {
    const result = await invoke('stop_record')

    const session = {
      id: Date.now().toString(),
      events: result,
      remark: '',
      createTime: Date.now(),
      duration: recordingTime.value,
      eventCount: result.length
    }

    recordingSessions.value.unshift(session)

    isRecording.value = false
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
    message.success(`录制完成，共 ${result.length} 个事件`)
  } catch (error) {
    message.error(error)
  }
}

// 会话管理功能
const toggleSessionExpand = (sessionId) => {
  if (expandedSessions.value.has(sessionId)) {
    expandedSessions.value.delete(sessionId)
  } else {
    expandedSessions.value.add(sessionId)
  }
}

const startEditRemark = (session) => {
  editingSessionId.value = session.id
  editingRemark.value = session.remark
}

const saveRemark = (sessionId) => {
  const session = recordingSessions.value.find(s => s.id === sessionId)
  if (session) {
    session.remark = editingRemark.value
  }
  editingSessionId.value = null
  editingRemark.value = ''
}

const cancelEditRemark = () => {
  editingSessionId.value = null
  editingRemark.value = ''
}

const deleteSession = (sessionId) => {
  const index = recordingSessions.value.findIndex(s => s.id === sessionId)
  if (index !== -1) {
    recordingSessions.value.splice(index, 1)
    expandedSessions.value.delete(sessionId)
    message.success('录制已删除')
  }
}

const playSession = async (session) => {
  try {
    if (executeDelayEnabled.value) {
      await startExecuteDelay()
    }

    await invoke('set_recorded_events', { events: session.events })

    const count = isInfinite.value ? 0 : repeatCount.value
    await invoke('play_record', { repeatCount: count })
    isPlaying.value = true
    message.success(isInfinite.value ? '开始无限循环回放' : `开始回放 ${count} 次`)
  } catch (error) {
    message.error(error)
  }
}

const stopPlaying = async () => {
  try {
    await invoke('stop_play')
    isPlaying.value = false
    message.info('已停止回放')
  } catch (error) {
    message.error(error)
  }
}

const clearAllSessions = () => {
  recordingSessions.value = []
  expandedSessions.value.clear()
  message.success('所有录制已清空')
}

const exportSession = (session) => {
  const dataStr = JSON.stringify(session, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `recording_${session.id}.json`
  link.click()
  URL.revokeObjectURL(url)
  message.success('导出成功')
}

const exportAllSessions = () => {
  if (recordingSessions.value.length === 0) {
    message.warning('没有可导出的录制')
    return
  }

  const dataStr = JSON.stringify(recordingSessions.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `all_recordings_${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
  message.success('导出成功')
}

const importSessions = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result)

        if (Array.isArray(imported)) {
          recordingSessions.value.unshift(...imported)
          message.success(`导入成功，共 ${imported.length} 个录制`)
        } else if (imported.id && imported.events) {
          recordingSessions.value.unshift(imported)
          message.success('导入成功')
        } else {
          message.error('导入失败：文件格式错误')
        }
      } catch (error) {
        message.error('导入失败：文件格式错误')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

const updateStatus = async () => {
  try {
    const status = await invoke('get_recorder_status')
    const wasRecording = isRecording.value
    isRecording.value = status.is_recording
    isPlaying.value = status.is_playing

    // 如果之前在录制，现在停止了（按了Ctrl+ESC），自动获取录制结果
    if (wasRecording && !isRecording.value && recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null

      try {
        const result = await invoke('get_recorded_events')

        if (result && result.length > 0) {
          const session = {
            id: Date.now().toString(),
            events: result,
            remark: '',
            createTime: Date.now(),
            duration: recordingTime.value,
            eventCount: result.length
          }

          recordingSessions.value.unshift(session)
          message.success(`录制完成（Ctrl+ESC停止），共 ${result.length} 个事件`)
        }
      } catch (error) {
        console.error('获取录制结果失败:', error)
      }
    }
  } catch (error) {
    console.error('获取状态失败:', error)
  }
}

const formatEventForTable = (event, index) => {
  let details = ''
  if (event.event_type === 'MouseMove') {
    details = `坐标: (${Math.round(event.x)}, ${Math.round(event.y)})`
  } else if (event.event_type.includes('Button')) {
    details = `按钮: ${event.button}`
  } else if (event.event_type.includes('Key')) {
    details = `按键: ${event.key}`
  }

  return {
    key: index,
    index: index + 1,
    event_type: event.event_type,
    details,
    timestamp: event.timestamp,
  }
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 监听配置变化，自动保存到 store
watch(countdownEnabled, async (newValue) => {
  if (settingsStore) {
    await settingsStore.set('recorder_countdownEnabled', newValue)
  }
})

watch(countdownSeconds, async (newValue) => {
  if (settingsStore) {
    await settingsStore.set('recorder_countdownSeconds', newValue)
  }
})

watch(executeDelayEnabled, async (newValue) => {
  if (settingsStore) {
    await settingsStore.set('recorder_executeDelayEnabled', newValue)
  }
})

watch(executeDelaySeconds, async (newValue) => {
  if (settingsStore) {
    await settingsStore.set('recorder_executeDelaySeconds', newValue)
  }
})

// 监听会话列表变化，自动保存到 store
watch(recordingSessions, async (newValue) => {
  if (sessionsStore) {
    await sessionsStore.set('recorder_sessions', newValue)
  }
}, { deep: true })

onMounted(async () => {
  try {
    settingsStore = await Store.load('settings.json', { autoSave: true })

    const savedCountdownEnabled = await settingsStore.get('recorder_countdownEnabled')
    const savedCountdownSeconds = await settingsStore.get('recorder_countdownSeconds')
    const savedExecuteDelayEnabled = await settingsStore.get('recorder_executeDelayEnabled')
    const savedExecuteDelaySeconds = await settingsStore.get('recorder_executeDelaySeconds')

    if (savedCountdownEnabled !== null) countdownEnabled.value = savedCountdownEnabled
    if (savedCountdownSeconds !== null) countdownSeconds.value = savedCountdownSeconds
    if (savedExecuteDelayEnabled !== null) executeDelayEnabled.value = savedExecuteDelayEnabled
    if (savedExecuteDelaySeconds !== null) executeDelaySeconds.value = savedExecuteDelaySeconds

    sessionsStore = await Store.load('recorder_sessions.json', { autoSave: true })

    const savedSessions = await sessionsStore.get('recorder_sessions')
    if (savedSessions && Array.isArray(savedSessions)) {
      recordingSessions.value = savedSessions
    }
  } catch (error) {
    console.error('初始化 store 失败:', error)
    message.error('加载配置失败')
  }

  statusTimer = setInterval(updateStatus, 1000)
})

onUnmounted(() => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  if (statusTimer) {
    clearInterval(statusTimer)
  }
})
</script>

<template>
  <div class="recorder-container">
    <!-- 顶部控制区 -->
    <a-row :gutter="[16, 16]">
      <!-- 录制控制 -->
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" class="control-card hover-card">
          <template #title>
            <div class="card-title">
              <VideoCameraOutlined style="color: #ff4d4f" />
              <span>录制控制</span>
            </div>
          </template>
          
          <div class="control-content">
            <!-- 状态显示区 -->
            <div class="status-display-area">
              <div v-if="isCountingDown" class="status-box countdown-box">
                <div class="status-value">{{ currentCountdown }}</div>
                <div class="status-label">准备开始...</div>
              </div>
              
              <div v-else-if="isRecording" class="status-box recording-box">
                <div class="pulse-dot"></div>
                <div class="status-value time-font">{{ formatTime(recordingTime) }}</div>
                <div class="status-label">录制中 (Ctrl+ESC 停止)</div>
              </div>

              <div v-else class="status-box idle-box">
                <div class="status-icon"><VideoCameraOutlined /></div>
                <div class="status-label">准备就绪</div>
              </div>
            </div>

            <!-- 操作区 -->
            <div class="action-area">
              <div class="config-row">
                <a-checkbox v-model:checked="countdownEnabled" :disabled="isRecording || isPlaying">
                  倒计时
                </a-checkbox>
                <a-input-number
                  v-model:value="countdownSeconds"
                  :min="1"
                  :max="10"
                  size="small"
                  style="width: 60px"
                  :disabled="!countdownEnabled || isRecording || isPlaying"
                />
                <span class="unit">秒</span>
              </div>

              <div class="main-btn">
                <a-button
                  v-if="!isRecording"
                  type="primary"
                  danger
                  size="large"
                  block
                  shape="round"
                  @click="startRecording"
                  :disabled="isPlaying || isCountingDown"
                >
                  <template #icon><PlayCircleOutlined /></template>
                  开始录制
                </a-button>
                <a-button
                  v-else
                  size="large"
                  block
                  shape="round"
                  class="stop-btn"
                  @click="stopRecording"
                >
                  <template #icon><StopOutlined /></template>
                  停止录制
                </a-button>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>

      <!-- 回放控制 -->
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" class="control-card hover-card">
          <template #title>
            <div class="card-title">
              <PlayCircleOutlined style="color: #52c41a" />
              <span>回放配置</span>
            </div>
          </template>

          <div class="control-content">
             <!-- 状态显示区 -->
             <div class="status-display-area">
              <div v-if="isExecuteDelaying" class="status-box delay-box">
                <div class="status-value">{{ currentExecuteDelay }}</div>
                <div class="status-label">等待执行...</div>
              </div>
              
              <div v-else-if="isPlaying" class="status-box playing-box">
                <a-spin size="large" />
                <div class="status-label" style="margin-top: 12px">正在回放 (Ctrl+ESC 停止)</div>
              </div>

              <div v-else class="status-box idle-box">
                <div class="status-icon"><PlayCircleOutlined /></div>
                <div class="status-label">等待指令</div>
              </div>
            </div>

            <!-- 操作区 -->
            <div class="action-area">
              <div class="config-group">
                <div class="config-row">
                  <a-checkbox v-model:checked="executeDelayEnabled" :disabled="isRecording || isPlaying">
                    延迟启动
                  </a-checkbox>
                  <a-input-number
                    v-model:value="executeDelaySeconds"
                    :min="1"
                    :max="10"
                    size="small"
                    style="width: 60px"
                    :disabled="!executeDelayEnabled || isRecording || isPlaying"
                  />
                  <span class="unit">秒</span>
                </div>
                <div class="config-row">
                   <span class="label">循环:</span>
                   <a-input-number
                    v-model:value="repeatCount"
                    :min="1"
                    :max="999"
                    size="small"
                    style="width: 60px"
                    :disabled="isInfinite || isRecording || isPlaying"
                  />
                  <a-checkbox
                    v-model:checked="isInfinite"
                    style="margin-left: 8px"
                    :disabled="isRecording || isPlaying"
                  >
                    无限
                  </a-checkbox>
                </div>
              </div>

              <div class="main-btn">
                 <a-button
                  v-if="isPlaying"
                  danger
                  size="large"
                  block
                  shape="round"
                  @click="stopPlaying"
                >
                  <template #icon><PauseCircleOutlined /></template>
                  停止回放
                </a-button>
                <div v-else class="playback-hint">
                  请在下方列表中选择一个录制进行回放
                </div>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 录制列表 -->
    <a-card :bordered="false" class="sessions-card hover-card" style="margin-top: 16px">
      <template #title>
        <div class="card-title">
          <FolderOpenOutlined style="color: #1890ff" />
          <span>录制列表</span>
          <a-tag color="blue" style="margin-left: 8px">{{ recordingSessions.length }}</a-tag>
        </div>
      </template>
      <template #extra>
        <a-space>
          <a-button type="dashed" size="small" @click="importSessions" :disabled="isRecording || isPlaying">
            <template #icon><FolderOpenOutlined /></template>
            导入
          </a-button>
          <a-button type="dashed" size="small" @click="exportAllSessions" :disabled="recordingSessions.length === 0">
            <template #icon><SaveOutlined /></template>
            导出全部
          </a-button>
          <a-popconfirm
            title="确定要清空所有录制吗？"
            @confirm="clearAllSessions"
          >
            <a-button type="dashed" danger size="small" :disabled="isRecording || isPlaying || recordingSessions.length === 0">
              <template #icon><DeleteOutlined /></template>
              清空
            </a-button>
          </a-popconfirm>
        </a-space>
      </template>

      <div v-if="recordingSessions.length === 0" class="empty-state">
        <a-empty description="暂无录制记录，请点击上方“开始录制”" />
      </div>

      <div v-else class="sessions-list">
        <transition-group name="list">
          <div
            v-for="session in recordingSessions"
            :key="session.id"
            class="session-item"
            :class="{ 'expanded': expandedSessions.has(session.id) }"
          >
            <div class="session-main">
              <!-- 左侧信息 -->
              <div class="session-info">
                <div class="session-header-row">
                  <span class="session-time">{{ formatDate(session.createTime) }}</span>
                  <a-tag color="cyan">{{ formatTime(session.duration) }}</a-tag>
                  <a-tag>{{ session.eventCount }} 事件</a-tag>
                </div>
                <div class="session-remark-row">
                   <div v-if="editingSessionId === session.id" class="remark-edit">
                      <a-input
                        v-model:value="editingRemark"
                        placeholder="输入备注..."
                        size="small"
                        @pressEnter="saveRemark(session.id)"
                        ref="remarkInput"
                      />
                      <a-button type="link" size="small" @click="saveRemark(session.id)"><CheckOutlined /></a-button>
                      <a-button type="link" size="small" danger @click="cancelEditRemark"><CloseOutlined /></a-button>
                   </div>
                   <div v-else class="remark-view" @click="startEditRemark(session)">
                      <EditOutlined class="edit-icon" />
                      <span class="remark-text" :class="{'placeholder': !session.remark}">
                        {{ session.remark || '点击添加备注...' }}
                      </span>
                   </div>
                </div>
              </div>

              <!-- 右侧操作 -->
              <div class="session-actions">
                <a-tooltip title="回放此录制">
                  <a-button
                    type="primary"
                    shape="circle"
                    size="large"
                    @click="playSession(session)"
                    :disabled="isRecording || isPlaying"
                  >
                    <template #icon><PlayCircleOutlined /></template>
                  </a-button>
                </a-tooltip>
                
                <a-divider type="vertical" />

                <a-dropdown>
                  <a-button type="text" shape="circle">
                    <template #icon><EllipsisOutlined /></template>
                  </a-button>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item key="export" @click="exportSession(session)">
                        <SaveOutlined /> 导出
                      </a-menu-item>
                      <a-menu-item key="delete" danger @click="deleteSession(session.id)">
                        <DeleteOutlined /> 删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>

                <a-button
                  type="text"
                  size="small"
                  @click="toggleSessionExpand(session.id)"
                >
                  <template #icon>
                    <DownOutlined :rotate="expandedSessions.has(session.id) ? 180 : 0" />
                  </template>
                </a-button>
              </div>
            </div>

            <!-- 展开详情 -->
            <div v-show="expandedSessions.has(session.id)" class="session-detail-panel">
               <a-table
                :columns="columns"
                :data-source="session.events.map((e, i) => formatEventForTable(e, i))"
                :pagination="{ pageSize: 5, size: 'small' }"
                size="small"
                :scroll="{ y: 240 }"
              />
            </div>
          </div>
        </transition-group>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.recorder-container {
  padding-bottom: 24px;
}

.hover-card {
  transition: all 0.3s;
  border-radius: 12px;
}
.hover-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.control-content {
  display: flex;
  flex-direction: column;
  height: 220px; /* 固定高度以保持对齐 */
}

.status-display-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7f9fa;
  border-radius: 8px;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}

.status-box {
  text-align: center;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.idle-box .status-icon {
  font-size: 32px;
  color: #d9d9d9;
  margin-bottom: 8px;
}
.idle-box .status-label {
  color: #999;
}

.countdown-box {
  background: #1890ff;
  color: #fff;
}
.countdown-box .status-value {
  font-size: 48px;
  font-weight: bold;
}

.recording-box {
  background: #fff1f0;
  border: 1px solid #ffccc7;
}
.recording-box .status-value {
  font-size: 32px;
  color: #cf1322;
  font-weight: bold;
  font-family: monospace;
}
.recording-box .pulse-dot {
  width: 12px;
  height: 12px;
  background: #f5222d;
  border-radius: 50%;
  margin-bottom: 8px;
  animation: pulse 1.5s infinite;
}

.delay-box {
  background: #722ed1;
  color: #fff;
}
.delay-box .status-value {
  font-size: 48px;
  font-weight: bold;
}

.action-area {
  height: 80px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  gap: 8px;
}
.config-group {
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
}

.playback-hint {
  text-align: center;
  color: #999;
  font-size: 12px;
  line-height: 40px; /* match button height */
  background: #f5f5f5;
  border-radius: 20px;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-item {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  transition: all 0.3s;
}

.session-item:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.session-main {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.session-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.session-time {
  font-weight: 500;
  color: #262626;
}

.remark-view {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #666;
  font-size: 13px;
}
.remark-view:hover {
  color: #1890ff;
}
.remark-text.placeholder {
  color: #bfbfbf;
  font-style: italic;
}

.remark-edit {
  display: flex;
  align-items: center;
  gap: 4px;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-detail-panel {
  border-top: 1px dashed #f0f0f0;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 0 0 8px 8px;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 34, 45, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(245, 34, 45, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 34, 45, 0); }
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
