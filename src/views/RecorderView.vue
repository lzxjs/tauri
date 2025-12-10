<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { message } from 'ant-design-vue'
import { Store } from '@tauri-apps/plugin-store'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import {
  PlayCircleFilled,
  StopFilled,
  PauseCircleFilled,
  FolderOpenOutlined,
  SaveOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  VideoCameraFilled,
  EllipsisOutlined,
  ReloadOutlined,
  ThunderboltFilled,
  ClockCircleOutlined,
  SettingOutlined,
  RocketOutlined,
  HistoryOutlined
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
const countdownSeconds = ref(5)
const isCountingDown = ref(false)
const currentCountdown = ref(0)

// 执行延迟配置
const executeDelayEnabled = ref(true)
const executeDelaySeconds = ref(3)
const isExecuteDelaying = ref(false)
const currentExecuteDelay = ref(0)

// 回放配置
const repeatCount = ref(1)
const isInfinite = ref(false)
const playbackSpeed = ref(1)
const skipIdleEnabled = ref(false)
const maxIdleSeconds = ref(1)

// 录制会话管理
const recordingSessions = ref([])
const expandedSessions = ref(new Set())
const editingSessionId = ref(null)
const editingRemark = ref('')

// 事件详情表格列定义
const columns = [
  { title: '序号', dataIndex: 'index', key: 'index', width: 80, align: 'center' },
  { title: '事件类型', dataIndex: 'event_type', key: 'event_type', width: 150 },
  { title: '详情', dataIndex: 'details', key: 'details' },
  { title: '时间戳 (ms)', dataIndex: 'timestamp', key: 'timestamp', width: 120, align: 'right' },
]

// 计算属性：当前状态文本
const statusText = computed(() => {
  if (isCountingDown.value) return `倒计时 ${currentCountdown.value}s`
  if (isRecording.value) return '正在录制'
  if (isExecuteDelaying.value) return `等待执行 ${currentExecuteDelay.value}s`
  if (isPlaying.value) return '正在回放'
  return '准备就绪'
})

// 重置设置
const resetSettings = () => {
  countdownEnabled.value = true
  countdownSeconds.value = 5
  executeDelayEnabled.value = true
  executeDelaySeconds.value = 3
  repeatCount.value = 1
  isInfinite.value = false
  playbackSpeed.value = 1
  skipIdleEnabled.value = false
  maxIdleSeconds.value = 1
  message.success('设置已恢复默认')
}

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

    // 克隆事件数据以进行处理（不影响原数据）
    let events = JSON.parse(JSON.stringify(session.events))
    
    // 处理回放速度和跳过空闲
    if (events.length > 0) {
      // 确保按时间排序
      events.sort((a, b) => a.timestamp - b.timestamp)
      
      const startTime = events[0].timestamp
      let currentTimestamp = startTime
      let previousOriginalTimestamp = startTime
      
      for (let i = 0; i < events.length; i++) {
        const originalTimestamp = events[i].timestamp
        let delta = originalTimestamp - previousOriginalTimestamp
        
        // 应用跳过空闲
        if (skipIdleEnabled.value && delta > maxIdleSeconds.value * 1000) {
          delta = maxIdleSeconds.value * 1000
        }
        
        // 应用回放速度
        if (playbackSpeed.value !== 1) {
          delta = delta / playbackSpeed.value
        }
        
        currentTimestamp += delta
        events[i].timestamp = Math.round(currentTimestamp)
        
        previousOriginalTimestamp = originalTimestamp
      }
    }

    await invoke('set_recorded_events', { events: events })

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

const exportSession = async (session) => {
  try {
    const filePath = await save({
      filters: [{
        name: 'JSON File',
        extensions: ['json']
      }],
      defaultPath: `recording_${session.id}.json`
    })

    if (!filePath) return

    const dataStr = JSON.stringify(session, null, 2)
    await writeTextFile(filePath, dataStr)
    message.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    message.error('导出失败: ' + error)
  }
}

const exportAllSessions = async () => {
  if (recordingSessions.value.length === 0) {
    message.warning('没有可导出的录制')
    return
  }

  try {
    const filePath = await save({
      filters: [{
        name: 'JSON File',
        extensions: ['json']
      }],
      defaultPath: `all_recordings_${Date.now()}.json`
    })

    if (!filePath) return

    const dataStr = JSON.stringify(recordingSessions.value, null, 2)
    await writeTextFile(filePath, dataStr)
    message.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    message.error('导出失败: ' + error)
  }
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
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 监听配置变化，自动保存到 store
watch(countdownEnabled, async (newValue) => {
  if (settingsStore) await settingsStore.set('recorder_countdownEnabled', newValue)
})
watch(countdownSeconds, async (newValue) => {
  if (settingsStore) await settingsStore.set('recorder_countdownSeconds', newValue)
})
watch(executeDelayEnabled, async (newValue) => {
  if (settingsStore) await settingsStore.set('recorder_executeDelayEnabled', newValue)
})
watch(executeDelaySeconds, async (newValue) => {
  if (settingsStore) await settingsStore.set('recorder_executeDelaySeconds', newValue)
})
watch(playbackSpeed, async (newValue) => {
  if (settingsStore) await settingsStore.set('recorder_playbackSpeed', newValue)
})
watch(skipIdleEnabled, async (newValue) => {
  if (settingsStore) await settingsStore.set('recorder_skipIdleEnabled', newValue)
})
watch(maxIdleSeconds, async (newValue) => {
  if (settingsStore) await settingsStore.set('recorder_maxIdleSeconds', newValue)
})
watch(recordingSessions, async (newValue) => {
  if (sessionsStore) await sessionsStore.set('recorder_sessions', newValue)
}, { deep: true })

const showInstructionModal = ref(false)
onMounted(async () => {
  try {
    settingsStore = await Store.load('settings.json', { autoSave: true })
    sessionsStore = await Store.load('recorder_sessions.json', { autoSave: true })

    const savedCountdownEnabled = await settingsStore.get('recorder_countdownEnabled')
    const savedCountdownSeconds = await settingsStore.get('recorder_countdownSeconds')
    const savedExecuteDelayEnabled = await settingsStore.get('recorder_executeDelayEnabled')
    const savedExecuteDelaySeconds = await settingsStore.get('recorder_executeDelaySeconds')
    const savedPlaybackSpeed = await settingsStore.get('recorder_playbackSpeed')
    const savedSkipIdleEnabled = await settingsStore.get('recorder_skipIdleEnabled')
    const savedMaxIdleSeconds = await settingsStore.get('recorder_maxIdleSeconds')

    if (savedCountdownEnabled !== null) countdownEnabled.value = savedCountdownEnabled
    if (savedCountdownSeconds !== null) countdownSeconds.value = savedCountdownSeconds
    if (savedExecuteDelayEnabled !== null) executeDelayEnabled.value = savedExecuteDelayEnabled
    if (savedExecuteDelaySeconds !== null) executeDelaySeconds.value = savedExecuteDelaySeconds
    if (savedPlaybackSpeed !== null) playbackSpeed.value = savedPlaybackSpeed
    if (savedSkipIdleEnabled !== null) skipIdleEnabled.value = savedSkipIdleEnabled
    if (savedMaxIdleSeconds !== null) maxIdleSeconds.value = savedMaxIdleSeconds

    const savedSessions = await sessionsStore.get('recorder_sessions')
    if (savedSessions && Array.isArray(savedSessions)) {
      recordingSessions.value = savedSessions
    }
  } catch (error) {
    console.error('初始化 store 失败:', error)
  }
  showInstructionModal.value = true
  statusTimer = setInterval(updateStatus, 1000)
})

onUnmounted(() => {
  if (recordingTimer) clearInterval(recordingTimer)
  if (statusTimer) clearInterval(statusTimer)
})
</script>

<template>
  <div class="recorder-container">
    <!-- 顶部标题栏 -->
    <div class="page-header glass-panel">
      <div class="header-left">
        <div class="header-icon-box">
          <VideoCameraFilled />
        </div>
        <div class="header-title">操作录制</div>
      </div>
      <div class="header-right">
        <div class="status-indicator" :class="{
          'recording': isRecording,
          'playing': isPlaying,
          'waiting': isCountingDown || isExecuteDelaying
        }">
          <div class="dot"></div>
          <span class="status-text">{{ statusText }}</span>
          <span v-if="isRecording" class="time-counter">{{ formatTime(recordingTime) }}</span>
        </div>
        <a-tooltip title="恢复默认设置">
          <a-button type="text" shape="circle" @click="resetSettings">
            <ReloadOutlined />
          </a-button>
        </a-tooltip>
      </div>
    </div>

    <!-- 主要内容区 -->
    <div class="content-grid">
      <!-- 左侧：控制面板 -->
      <div class="control-panel">
        <!-- 录制卡片 -->
        <div class="panel-card record-card" :class="{ 'active': isRecording }">
          <div class="card-header">
            <div class="card-title">
              <div class="icon-wrapper red">
                <div class="record-dot"></div>
              </div>
              录制配置
            </div>
            <a-switch 
              v-model:checked="countdownEnabled" 
              checked-children="倒计时开" 
              un-checked-children="倒计时关"
              :disabled="isRecording || isPlaying"
            />
          </div>
          
          <div class="card-body">
            <div class="setting-row" v-if="countdownEnabled">
              <span class="label">倒计时时长</span>
              <div class="value-control">
                <a-input-number
                  v-model:value="countdownSeconds"
                  :min="1"
                  :max="10"
                  size="small"
                  :disabled="isRecording || isPlaying"
                />
                <span class="unit">秒</span>
              </div>
            </div>

            <div class="action-btn-area">
              <button 
                class="big-action-btn record-btn" 
                :class="{ 'recording': isRecording, 'disabled': isPlaying || isCountingDown }"
                @click="isRecording ? stopRecording() : startRecording()"
                :disabled="isPlaying || isCountingDown"
              >
                <div class="btn-inner">
                  <component :is="isRecording ? StopFilled : VideoCameraFilled" />
                  <span>{{ isRecording ? '停止录制' : '开始录制' }}</span>
                </div>
                <div v-if="isRecording" class="pulse-ring"></div>
              </button>
            </div>
          </div>
        </div>

        <!-- 回放卡片 -->
        <div class="panel-card playback-card" :class="{ 'active': isPlaying }">
          <div class="card-header">
            <div class="card-title">
              <div class="icon-wrapper green">
                <PlayCircleFilled />
              </div>
              回放配置
            </div>
          </div>
          
          <div class="card-body">
            <div class="settings-grid">
              <div class="setting-item">
                <div class="label"><RocketOutlined /> 启动延迟</div>
                <div class="control-group">
                  <a-checkbox v-model:checked="executeDelayEnabled" :disabled="isRecording || isPlaying" />
                  <a-input-number 
                    v-model:value="executeDelaySeconds" 
                    :min="1" :max="10" size="small" 
                    :disabled="!executeDelayEnabled || isRecording || isPlaying" 
                    style="width: 60px"
                  />
                  <span class="unit">s</span>
                </div>
              </div>

              <div class="setting-item">
                <div class="label"><ThunderboltFilled /> 播放倍速</div>
                <a-select 
                  v-model:value="playbackSpeed" 
                  size="small" 
                  style="width: 100%" 
                  :disabled="isRecording || isPlaying" 
                  :options="[
                    { value: 0.5, label: '0.5x 慢速' },
                    { value: 1, label: '1.0x 正常' },
                    { value: 2, label: '2.0x 快速' },
                    { value: 4, label: '4.0x 极速' },
                    { value: 8, label: '8.0x 飞速' }
                  ]" 
                />
              </div>

              <div class="setting-item full-width">
                <div class="label"><HistoryOutlined /> 循环设置</div>
                <div class="control-group">
                   <a-radio-group v-model:value="isInfinite" size="small" :disabled="isRecording || isPlaying">
                    <a-radio :value="false">有限</a-radio>
                    <a-radio :value="true">无限</a-radio>
                  </a-radio-group>
                  <a-input-number
                    v-if="!isInfinite"
                    v-model:value="repeatCount"
                    :min="1" :max="999" size="small"
                    :disabled="isRecording || isPlaying"
                    style="width: 60px"
                  />
                  <span v-if="!isInfinite" class="unit">次</span>
                </div>
              </div>
              
               <div class="setting-item full-width">
                <div class="label"><ClockCircleOutlined /> 智能跳过</div>
                 <div class="control-group">
                  <a-checkbox v-model:checked="skipIdleEnabled" :disabled="isRecording || isPlaying">
                    跳过 > {{ maxIdleSeconds }}s 的空闲
                  </a-checkbox>
                   <a-input-number
                    v-if="skipIdleEnabled"
                    v-model:value="maxIdleSeconds"
                    :min="0.1" :max="10" :step="0.1" size="small"
                    :disabled="isRecording || isPlaying"
                    style="width: 50px; margin-left: 4px;"
                  />
                </div>
              </div>
            </div>

            <div class="action-btn-area">
               <button 
                class="big-action-btn play-btn" 
                :class="{ 'playing': isPlaying, 'disabled': isRecording || isExecuteDelaying }"
                v-if="isPlaying"
                @click="stopPlaying"
              >
                 <div class="btn-inner">
                  <StopFilled />
                  <span>停止回放</span>
                </div>
              </button>
              <div v-else class="play-placeholder">
                请在右侧列表选择录制进行回放
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：列表区域 -->
      <div class="list-panel glass-panel">
        <div class="panel-header">
          <div class="header-left">
            <FolderOpenOutlined />
            <span>录制列表</span>
            <span class="count-badge">{{ recordingSessions.length }}</span>
          </div>
          <div class="header-actions">
            <a-dropdown placement="bottomRight">
               <a-button type="text" shape="circle">
                <EllipsisOutlined />
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="importSessions" :disabled="isRecording || isPlaying">
                    <FolderOpenOutlined /> 导入记录
                  </a-menu-item>
                  <a-menu-item @click="exportAllSessions" :disabled="recordingSessions.length === 0">
                    <SaveOutlined /> 导出全部
                  </a-menu-item>
                   <a-menu-divider />
                  <a-menu-item danger @click="clearAllSessions" :disabled="isRecording || isPlaying || recordingSessions.length === 0">
                    <DeleteOutlined /> 清空列表
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>

        <div class="sessions-container custom-scrollbar">
          <transition-group name="list">
             <div v-if="recordingSessions.length === 0" class="empty-state" key="empty">
               <img src="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg" alt="empty" />
               <p>暂无录制记录</p>
               <span class="sub-text">点击左侧"开始录制"创建新记录</span>
             </div>

            <div
              v-for="session in recordingSessions"
              :key="session.id"
              class="session-card"
              :class="{ 'expanded': expandedSessions.has(session.id) }"
            >
              <div class="session-main-row">
                <div class="session-info-group">
                   <div class="info-top">
                     <span class="time-tag">{{ formatDate(session.createTime) }}</span>
                     <span class="duration-tag">{{ formatTime(session.duration) }}</span>
                     <span class="event-tag">{{ session.eventCount }} 事件</span>
                   </div>
                   <div class="info-remark">
                      <div v-if="editingSessionId === session.id" class="remark-edit-box">
                        <a-input
                          v-model:value="editingRemark"
                          placeholder="输入备注..."
                          size="small"
                          @pressEnter="saveRemark(session.id)"
                          auto-focus
                        />
                        <a-button type="text" size="small" class="success-text" @click="saveRemark(session.id)"><CheckOutlined /></a-button>
                        <a-button type="text" size="small" class="danger-text" @click="cancelEditRemark"><CloseOutlined /></a-button>
                      </div>
                      <div v-else class="remark-display" @click.stop="startEditRemark(session)">
                        <EditOutlined class="edit-icon" />
                        <span v-if="session.remark" class="text">{{ session.remark }}</span>
                        <span v-else class="placeholder">添加备注...</span>
                      </div>
                   </div>
                </div>

                <div class="session-action-group">
                   <a-tooltip title="播放" placement="top">
                    <button class="icon-btn play" @click="playSession(session)" :disabled="isRecording || isPlaying">
                      <PlayCircleFilled />
                    </button>
                   </a-tooltip>
                   
                   <a-dropdown placement="bottomRight" :trigger="['click']">
                     <button class="icon-btn more"><EllipsisOutlined /></button>
                     <template #overlay>
                       <a-menu>
                         <a-menu-item @click="exportSession(session)"><SaveOutlined /> 导出JSON</a-menu-item>
                         <a-menu-item danger @click="deleteSession(session.id)"><DeleteOutlined /> 删除记录</a-menu-item>
                       </a-menu>
                     </template>
                   </a-dropdown>

                   <button 
                    class="icon-btn expand" 
                    :class="{ 'is-expanded': expandedSessions.has(session.id) }"
                    @click="toggleSessionExpand(session.id)"
                  >
                     <DownOutlined />
                   </button>
                </div>
              </div>

              <div v-if="expandedSessions.has(session.id)" class="session-detail-area">
                <a-table
                  :columns="columns"
                  :data-source="session.events.map((e, i) => formatEventForTable(e, i))"
                  :pagination="{ pageSize: 5, size: 'small' }"
                  size="small"
                  :scroll="{ y: 200 }"
                  class="mini-table"
                />
              </div>
            </div>
          </transition-group>
        </div>
      </div>
    </div>

    <!-- 首次使用提示弹窗 -->
    <a-modal
      v-model:open="showInstructionModal"
      :closable="false"
      :maskClosable="false"
      :footer="null"
      width="360px"
      class="instruction-modal"
    >
      <div class="instruction-content">
        <h3>快捷键提示</h3>
        <div class="key-icon">Ctrl + ESC</div>
        <p>无论在 <strong>录制</strong> 还是 <strong>回放</strong> 过程中</p>
        <p>按下 <strong>Ctrl + ESC</strong> 即可随时停止</p>
        <a-button type="primary" shape="round" block @click="showInstructionModal = false" style="margin-top: 20px">
          我已知晓
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
/* 全局容器 */
.recorder-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: #f0f2f5;
  gap: 16px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 玻璃拟态面板基础样式 */
.glass-panel {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

/* 顶部标题栏 */
.page-header {
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-box {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #1890ff, #36cfc9);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  box-shadow: 0 4px 10px rgba(24, 144, 255, 0.3);
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f1f1f;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 状态指示器 */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f5f5f5;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  transition: all 0.3s;
}

.status-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d9d9d9;
}

.status-indicator.recording {
  background: #fff1f0;
  color: #cf1322;
  border: 1px solid #ffa39e;
}
.status-indicator.recording .dot {
  background: #f5222d;
  animation: blink 1s infinite;
}

.status-indicator.playing {
  background: #f6ffed;
  color: #389e0d;
  border: 1px solid #b7eb8f;
}
.status-indicator.playing .dot {
  background: #52c41a;
}

.status-indicator.waiting {
  background: #e6f7ff;
  color: #096dd9;
  border: 1px solid #91d5ff;
}
.status-indicator.waiting .dot {
  background: #1890ff;
}

.time-counter {
  font-family: 'Monaco', monospace;
  font-weight: bold;
}

/* 内容网格布局 */
.content-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0; /* 允许子元素滚动 */
}

/* 左侧控制面板 */
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.panel-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.panel-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.panel-card.active {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: #1f1f1f;
}

.icon-wrapper {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.icon-wrapper.red {
  background: #fff1f0;
  color: #f5222d;
}

.icon-wrapper.green {
  background: #f6ffed;
  color: #52c41a;
}

.record-dot {
  width: 10px;
  height: 10px;
  background: currentColor;
  border-radius: 50%;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 设置项样式 */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.value-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.setting-item {
  background: #fafafa;
  padding: 10px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-item.full-width {
  grid-column: span 2;
}

.setting-item .label {
  font-size: 12px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.unit {
  font-size: 12px;
  color: #999;
}

/* 大按钮样式 */
.action-btn-area {
  margin-top: 8px;
}

.big-action-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.big-action-btn .btn-inner {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-btn {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  box-shadow: 0 4px 15px rgba(255, 77, 79, 0.3);
}

.record-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(255, 77, 79, 0.4);
}

.record-btn.recording {
  background: #fff;
  color: #ff4d4f;
  border: 2px solid #ff4d4f;
}

.play-btn {
  background: linear-gradient(135deg, #52c41a, #95de64);
  box-shadow: 0 4px 15px rgba(82, 196, 26, 0.3);
}

.play-btn.playing {
   background: #fff;
   color: #52c41a;
   border: 2px solid #52c41a;
}

.big-action-btn.disabled {
  background: #d9d9d9;
  cursor: not-allowed;
  box-shadow: none;
  color: #999;
}

.play-placeholder {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 24px;
  color: #999;
  font-size: 13px;
  border: 1px dashed #d9d9d9;
}

/* 脉冲动画 */
.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 77, 79, 0.2);
  animation: ripple 1.5s infinite;
}

@keyframes ripple {
  0% { width: 0; height: 0; opacity: 1; }
  100% { width: 200px; height: 200px; opacity: 0; }
}

@keyframes blink {
  50% { opacity: 0.5; }
}

/* 右侧列表面板 */
.list-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header .header-left {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: #e6f7ff;
  color: #1890ff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: normal;
}

.sessions-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  gap: 16px;
}

.empty-state img {
  width: 120px;
  opacity: 0.8;
}

/* 会话卡片 */
.session-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
  transition: all 0.2s;
}

.session-card:hover {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.1);
  transform: translateX(4px);
}

.session-main-row {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-info-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-top {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.time-tag {
  color: #999;
}

.duration-tag {
  background: #fff7e6;
  color: #fa8c16;
  padding: 1px 6px;
  border-radius: 4px;
}

.event-tag {
  background: #f0f5ff;
  color: #2f54eb;
  padding: 1px 6px;
  border-radius: 4px;
}

.info-remark {
  min-height: 22px;
  display: flex;
  align-items: center;
}

.remark-display {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #333;
  font-size: 14px;
}
.remark-display:hover .edit-icon {
  opacity: 1;
}

.remark-display .placeholder {
  color: #ccc;
  font-style: italic;
  font-size: 13px;
}

.edit-icon {
  font-size: 12px;
  color: #1890ff;
  opacity: 0;
  transition: opacity 0.2s;
}

.remark-edit-box {
  display: flex;
  align-items: center;
  gap: 4px;
}

.success-text { color: #52c41a; }
.danger-text { color: #ff4d4f; }

.session-action-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #e6f7ff;
  color: #1890ff;
}

.icon-btn.play {
  color: #52c41a;
  background: #f6ffed;
  width: 36px;
  height: 36px;
  font-size: 18px;
}
.icon-btn.play:hover {
  background: #52c41a;
  color: white;
  transform: scale(1.1);
  box-shadow: 0 4px 10px rgba(82, 196, 26, 0.3);
}

.icon-btn.expand {
  background: transparent;
}
.icon-btn.expand.is-expanded {
  transform: rotate(180deg);
}

.session-detail-area {
  border-top: 1px solid #f0f0f0;
  padding: 0 16px 16px 16px;
  background: #fafafa;
  border-radius: 0 0 12px 12px;
}

/* 列表动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 弹窗样式 */
.instruction-content {
  text-align: center;
  padding: 10px 0;
}

.key-icon {
  background: #f5f5f5;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  padding: 8px 16px;
  font-family: monospace;
  font-weight: bold;
  font-size: 18px;
  color: #333;
  display: inline-block;
  margin-bottom: 16px;
  box-shadow: 0 4px 0 #e8e8e8;
}

/* 滚动条美化 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e8e8e8;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d9d9d9;
}
</style>
