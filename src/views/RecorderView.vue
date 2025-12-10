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
  VideoCameraOutlined
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

    // 如果之前在录制，现在停止了（按了ESC），自动获取录制结果
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
          message.success(`录制完成（ESC停止），共 ${result.length} 个事件`)
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
    <!-- 录制控制区 -->
    <a-row :gutter="16">
      <a-col :span="12">
        <a-card title="录制控制" class="control-card">
          <template #extra>
            <VideoCameraOutlined style="font-size: 18px; color: #1890ff" />
          </template>
          <a-space direction="vertical" size="middle" style="width: 100%">
            <!-- 倒计时配置 -->
            <div class="config-row">
              <a-checkbox
                v-model:checked="countdownEnabled"
                :disabled="isRecording || isPlaying"
              >
                启用倒计时
              </a-checkbox>
              <a-input-number
                v-model:value="countdownSeconds"
                :min="1"
                :max="10"
                :disabled="!countdownEnabled || isRecording || isPlaying"
                style="width: 80px; margin-left: 12px"
              />
              <span style="margin-left: 8px">秒</span>
            </div>

            <!-- 倒计时显示 -->
            <div v-if="isCountingDown" class="countdown-display">
              <div class="countdown-number">{{ currentCountdown }}</div>
              <div class="countdown-text">准备录制...</div>
            </div>

            <!-- 录制中显示 -->
            <div v-if="isRecording" class="recording-indicator">
              <a-badge status="processing" text="录制中" />
              <span class="recording-time">{{ formatTime(recordingTime) }}</span>
            </div>

            <a-button
              v-if="!isRecording && !isCountingDown"
              type="primary"
              size="large"
              block
              @click="startRecording"
              :disabled="isPlaying"
            >
              <template #icon><PlayCircleOutlined /></template>
              开始录制
            </a-button>

            <a-button
              v-if="isRecording"
              danger
              size="large"
              block
              @click="stopRecording"
            >
              <template #icon><StopOutlined /></template>
              停止录制
            </a-button>

            <a-alert
              message="提示：录制时按 ESC 键可立即停止"
              type="info"
              show-icon
            />
          </a-space>
        </a-card>
      </a-col>

      <a-col :span="12">
        <a-card title="回放控制" class="control-card">
          <template #extra>
            <PlayCircleOutlined style="font-size: 18px; color: #52c41a" />
          </template>
          <a-space direction="vertical" size="middle" style="width: 100%">
            <!-- 执行延迟配置 -->
            <div class="config-row">
              <a-checkbox
                v-model:checked="executeDelayEnabled"
                :disabled="isRecording || isPlaying || isExecuteDelaying"
              >
                启用执行延迟
              </a-checkbox>
              <a-input-number
                v-model:value="executeDelaySeconds"
                :min="1"
                :max="10"
                :disabled="!executeDelayEnabled || isRecording || isPlaying || isExecuteDelaying"
                style="width: 80px; margin-left: 12px"
              />
              <span style="margin-left: 8px">秒</span>
            </div>

            <!-- 执行延迟倒计时显示 -->
            <div v-if="isExecuteDelaying" class="countdown-display execute-delay">
              <div class="countdown-number">{{ currentExecuteDelay }}</div>
              <div class="countdown-text">准备执行...</div>
            </div>

            <div class="config-row">
              <span class="label">执行次数：</span>
              <a-input-number
                v-model:value="repeatCount"
                :min="1"
                :max="999"
                :disabled="isInfinite || isRecording || isPlaying"
                style="width: 100px"
              />
              <a-checkbox
                v-model:checked="isInfinite"
                :disabled="isRecording || isPlaying"
                style="margin-left: 16px"
              >
                无限循环
              </a-checkbox>
            </div>

            <div v-if="isPlaying" class="playing-indicator">
              <a-badge status="processing" text="回放中" />
            </div>

            <a-button
              v-if="isPlaying"
              danger
              size="large"
              block
              @click="stopPlaying"
            >
              <template #icon><PauseCircleOutlined /></template>
              停止回放
            </a-button>

            <a-alert
              message="提示：回放时按 ESC 键可立即停止"
              type="warning"
              show-icon
            />
          </a-space>
        </a-card>
      </a-col>
    </a-row>

    <!-- 录制列表 -->
    <a-card title="录制列表" class="sessions-card" style="margin-top: 16px">
      <template #extra>
        <a-space>
          <a-button @click="importSessions" :disabled="isRecording || isPlaying">
            <template #icon><FolderOpenOutlined /></template>
            导入
          </a-button>
          <a-button @click="exportAllSessions" :disabled="recordingSessions.length === 0">
            <template #icon><SaveOutlined /></template>
            导出全部
          </a-button>
          <a-button danger @click="clearAllSessions" :disabled="isRecording || isPlaying || recordingSessions.length === 0">
            <template #icon><DeleteOutlined /></template>
            清空
          </a-button>
        </a-space>
      </template>

      <div v-if="recordingSessions.length === 0" class="empty-sessions">
        <a-empty description="暂无录制记录" />
      </div>

      <div v-else class="sessions-list">
        <div
          v-for="session in recordingSessions"
          :key="session.id"
          class="session-card"
        >
          <div class="session-header">
            <div class="session-info">
              <div class="session-time">{{ formatDate(session.createTime) }}</div>
              <div class="session-stats">
                <a-tag color="blue">{{ session.eventCount }} 个事件</a-tag>
                <a-tag color="green">{{ formatTime(session.duration) }}</a-tag>
              </div>
            </div>
            <div class="session-actions">
              <a-button
                type="primary"
                size="small"
                @click="playSession(session)"
                :disabled="isRecording || isPlaying"
              >
                <template #icon><PlayCircleOutlined /></template>
                执行
              </a-button>
              <a-button
                size="small"
                @click="exportSession(session)"
                style="margin-left: 8px"
              >
                <template #icon><SaveOutlined /></template>
              </a-button>
              <a-button
                danger
                size="small"
                @click="deleteSession(session.id)"
                :disabled="isRecording || isPlaying"
                style="margin-left: 8px"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
              <a-button
                size="small"
                @click="toggleSessionExpand(session.id)"
                style="margin-left: 8px"
              >
                <template #icon>
                  <DownOutlined v-if="!expandedSessions.has(session.id)" />
                  <UpOutlined v-else />
                </template>
              </a-button>
            </div>
          </div>

          <div class="session-remark">
            <div v-if="editingSessionId !== session.id" class="remark-display">
              <span class="remark-label">备注：</span>
              <span class="remark-text">{{ session.remark || '无备注' }}</span>
              <a-button
                type="link"
                size="small"
                @click="startEditRemark(session)"
                :disabled="isRecording || isPlaying"
              >
                <template #icon><EditOutlined /></template>
              </a-button>
            </div>
            <div v-else class="remark-edit">
              <a-input
                v-model:value="editingRemark"
                placeholder="输入备注"
                style="flex: 1"
              />
              <a-button
                type="primary"
                size="small"
                @click="saveRemark(session.id)"
                style="margin-left: 8px"
              >
                <template #icon><CheckOutlined /></template>
              </a-button>
              <a-button
                size="small"
                @click="cancelEditRemark"
                style="margin-left: 8px"
              >
                <template #icon><CloseOutlined /></template>
              </a-button>
            </div>
          </div>

          <div v-if="expandedSessions.has(session.id)" class="session-details">
            <a-table
              :columns="columns"
              :data-source="session.events.map((e, i) => formatEventForTable(e, i))"
              :pagination="{ pageSize: 5 }"
              :scroll="{ y: 200 }"
              size="small"
            />
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.recorder-container {
  padding: 16px;
}

.control-card {
  border-radius: 8px;
}

.config-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.label {
  font-weight: 500;
  margin-right: 8px;
}

/* 倒计时显示 */
.countdown-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  animation: countdownPulse 1s ease-in-out infinite;
}

.countdown-display.execute-delay {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.countdown-number {
  font-size: 56px;
  font-weight: bold;
  color: white;
  text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
  animation: countdownScale 1s ease-in-out infinite;
}

.countdown-text {
  font-size: 16px;
  color: white;
  margin-top: 8px;
  opacity: 0.9;
}

@keyframes countdownPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.5); }
  50% { box-shadow: 0 0 40px rgba(102, 126, 234, 0.8); }
}

@keyframes countdownScale {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* 录制/回放指示器 */
.recording-indicator,
.playing-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: #f0f5ff;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
}

.recording-time {
  margin-left: 16px;
  font-family: 'Courier New', monospace;
  font-size: 20px;
  color: #1890ff;
}

/* 会话列表 */
.sessions-card {
  border-radius: 8px;
}

.empty-sessions {
  padding: 40px 0;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.session-card {
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.3s ease;
}

.session-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #1890ff;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.session-info {
  flex: 1;
}

.session-time {
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
}

.session-stats {
  display: flex;
  gap: 8px;
}

.session-actions {
  display: flex;
  align-items: center;
}

.session-remark {
  margin-bottom: 8px;
}

.remark-display {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

.remark-label {
  font-weight: 500;
  color: #666;
  margin-right: 8px;
}

.remark-text {
  flex: 1;
  color: #333;
}

.remark-edit {
  display: flex;
  align-items: center;
}

.session-details {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e8e8e8;
}

:deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
}
</style>
