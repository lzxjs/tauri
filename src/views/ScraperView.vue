<template>
  <div class="scraper-container">
    <!-- Top Bar: Request Control -->
    <div class="control-header">
      <div class="url-bar-card glass-panel">
        <div class="url-input-wrapper">
          <a-input-group compact class="custom-input-group">
            <a-select v-model:value="requestMethod" class="method-select" :bordered="false">
              <a-select-option value="GET">GET</a-select-option>
            </a-select>
            <div class="divider-vertical"></div>
            <a-auto-complete
              v-model:value="targetUrl"
              :options="urlHistoryOptions"
              class="url-input"
              :filterOption="false"
              @select="onSelectHistoryUrl"
              :bordered="false"
            >
              <a-input
                ref="urlInputRef"
                placeholder="输入目标网址 (例如 https://example.com)"
                @pressEnter="fetchPage"
                :bordered="false"
              >
                <template #prefix>
                   <LinkOutlined style="color: #bfbfbf" />
                </template>
              </a-input>
            </a-auto-complete>
            
            <div class="url-actions">
               <a-divider type="vertical" style="height: 20px; margin: 0 4px" />
               <a-tooltip title="粘贴网址">
                  <a-button type="text" shape="circle" @click="pasteUrl">
                    <CopyOutlined />
                  </a-button>
               </a-tooltip>
               <a-tooltip title="清空输入">
                  <a-button type="text" shape="circle" @click="clearTargetUrl" :disabled="!targetUrl">
                    <ClearOutlined />
                  </a-button>
               </a-tooltip>
               <a-tooltip title="在浏览器打开">
                  <a-button type="text" shape="circle" @click="openInBrowser" :disabled="!targetUrl">
                    <GlobalOutlined />
                  </a-button>
               </a-tooltip>
               <a-tooltip title="请求设置">
                  <a-button type="text" shape="circle" @click="settingsVisible = true">
                    <SettingOutlined />
                  </a-button>
               </a-tooltip>
               <a-tooltip title="清空历史">
                  <a-button type="text" shape="circle" @click="clearUrlHistory" :disabled="urlHistory.length === 0">
                     <HistoryOutlined />
                  </a-button>
               </a-tooltip>
            </div>

            <a-button type="primary" class="fetch-btn" :loading="loading" :disabled="!canFetch" @click="fetchPage">
              <template #icon><GlobalOutlined /></template>
              加载页面
            </a-button>
          </a-input-group>
        </div>
      </div>

      <div class="actions-bar">
         <a-radio-group v-model:value="isInspectorActive" button-style="solid" class="mode-switch">
            <a-radio-button :value="false">浏览模式</a-radio-button>
            <a-radio-button :value="true">
               <AimOutlined /> 选取模式
            </a-radio-button>
         </a-radio-group>
         
         <div class="right-actions">
            <a-button @click="showCodeModal" class="action-btn">
               <template #icon><CodeOutlined /></template>
               生成代码
            </a-button>

            <a-tooltip title="使用说明">
              <a-button class="action-btn" shape="circle" @click="helpModalVisible = true">
                <QuestionCircleOutlined />
              </a-button>
            </a-tooltip>
            
            <a-dropdown>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="save" @click="exportRules">
                    <SaveOutlined /> 保存规则配置
                  </a-menu-item>
                  <a-menu-item key="saveTpl" @click="openSaveTemplate">
                    <SaveOutlined /> 保存为本地模板
                  </a-menu-item>
                  <a-menu-item key="loadTpl" @click="openLoadTemplate">
                    <FolderOpenOutlined /> 加载本地模板
                  </a-menu-item>
                  <a-menu-item key="load" @click="triggerImport">
                    <FolderOpenOutlined /> 导入规则配置
                  </a-menu-item>
                </a-menu>
              </template>
              <a-button class="action-btn">
                 规则管理 <DownOutlined />
              </a-button>
            </a-dropdown>

             <input 
              type="file" 
              ref="fileInput" 
              style="display: none" 
              accept=".json"
              @change="importRules"
            />
         </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Left: Browser Preview -->
      <div class="pane browser-pane">
        <div class="pane-header">
          <div class="pane-title">
            <DesktopOutlined /> 页面预览
          </div>
          <div class="pane-controls">
             <span v-if="isInspectorActive" class="inspector-badge">
               <span class="pulse-dot"></span> 正在选取元素...
             </span>
             <a-radio-group v-model:value="isMobileView" size="small" button-style="solid">
                <a-radio-button :value="false"><DesktopOutlined /></a-radio-button>
                <a-radio-button :value="true"><MobileOutlined /></a-radio-button>
             </a-radio-group>
          </div>
        </div>
        
        <div class="browser-viewport-wrapper">
            <div class="browser-viewport" ref="browserContainer" :class="{ 'mobile-view': isMobileView }">
              <div class="browser-address-bar" v-if="processedHtml">
                 <div class="traffic-lights">
                    <span></span><span></span><span></span>
                 </div>
                 <div class="fake-url">{{ targetUrl || 'Empty Page' }}</div>
              </div>
              
              <div class="iframe-container">
                  <iframe
                    ref="previewFrame"
                    class="preview-iframe"
                    sandbox="allow-same-origin allow-scripts"
                    :srcdoc="processedHtml"
                  ></iframe>
                  
                  <div v-if="!processedHtml" class="empty-state">
                    <div class="empty-icon-bg">
                        <GlobalOutlined />
                    </div>
                    <h3>准备就绪</h3>
                    <p>在上方输入网址并点击"加载页面"开始配置</p>
                  </div>
                  
                  <div v-if="loading" class="loading-overlay">
                    <a-spin size="large" tip="正在加载页面资源..." />
                  </div>
              </div>
            </div>
        </div>
      </div>

      <!-- Right: Configuration -->
      <div class="pane config-pane">
        <a-tabs v-model:activeKey="activeTab" class="custom-tabs" :tabBarGutter="24">
          <!-- Fields Tab -->
          <a-tab-pane key="fields">
            <template #tab>
              <span class="tab-label">
                <ProfileOutlined />
                提取规则
              </span>
            </template>
            
            <div class="config-content scrollbar-custom">
              <div class="fields-list">
                 <transition-group name="list" tag="div">
                    <div v-for="(field, index) in fields" :key="index" class="field-card" :class="{ active: currentFieldIndex === index }" @click="currentFieldIndex = index">
                       <div class="field-card-header">
                          <div class="field-name">
                             <span class="field-index">#{{ index + 1 }}</span>
                             <a-input v-model:value="field.name" placeholder="字段名" size="small" class="field-name-input" :bordered="false" />
                          </div>
                          <div class="field-actions">
                             <a-tooltip title="复制">
                                <a-button type="text" size="small" @click.stop="duplicateField(index)"><CopyOutlined /></a-button>
                             </a-tooltip>
                             <a-tooltip title="删除">
                                <a-button type="text" danger size="small" @click.stop="removeField(index)"><DeleteOutlined /></a-button>
                             </a-tooltip>
                          </div>
                       </div>
                       
                       <div class="field-card-body" v-show="currentFieldIndex === index">
                          <div class="form-row">
                             <div class="form-item" style="flex: 1">
                                <label>CSS 选择器</label>
                                <div class="selector-input-group">
                                   <a-input v-model:value="field.selector" placeholder="点击左侧元素自动获取" size="small">
                                      <template #suffix>
                                         <span class="selector-suffix" @click.stop>
                                           <a-tooltip title="复制选择器">
                                             <CopyOutlined class="suffix-icon" @click.stop="copyFieldSelector(index)" />
                                           </a-tooltip>
                                           <a-tooltip title="清空选择器">
                                             <ClearOutlined class="suffix-icon" @click.stop="clearFieldSelector(index)" />
                                           </a-tooltip>
                                           <a-tooltip title="在预览中高亮">
                                             <AimOutlined class="aim-icon" :class="{ active: isInspectorActive }" @click.stop="highlightFieldSelector(index)" />
                                           </a-tooltip>
                                         </span>
                                      </template>
                                   </a-input>
                                </div>
                             </div>
                             <div class="form-item" style="width: 100px">
                                <label>属性</label>
                                <a-select v-model:value="field.attr" size="small" style="width: 100%">
                                    <a-select-option value="text">Text</a-select-option>
                                    <a-select-option value="html">HTML</a-select-option>
                                    <a-select-option value="href">Href</a-select-option>
                                    <a-select-option value="src">Src</a-select-option>
                                    <a-select-option value="custom">Custom</a-select-option>
                                </a-select>
                             </div>
                          </div>
                          
                          <div v-if="field.attr === 'custom'" class="form-row">
                             <div class="form-item">
                                <label>自定义属性名</label>
                                <a-input v-model:value="field.customAttr" placeholder="例如 data-id" size="small" />
                             </div>
                          </div>

                          <div v-if="processedHtml" class="field-sample">
                            <span class="sample-label">示例</span>
                            <span class="sample-value">{{ fieldSampleText(field.name) }}</span>
                          </div>

                          <div class="data-clean-section">
                             <div class="section-title">数据清洗</div>
                             <div class="form-row">
                                <div class="form-item" style="width: 100px">
                                   <a-select v-model:value="field.transformType" size="small" style="width: 100%">
                                      <a-select-option value="none">无处理</a-select-option>
                                      <a-select-option value="trim">Trim</a-select-option>
                                      <a-select-option value="regex">正则提取</a-select-option>
                                      <a-select-option value="replace">替换</a-select-option>
                                   </a-select>
                                </div>
                                <div class="form-item" style="flex: 1" v-if="['regex', 'replace'].includes(field.transformType)">
                                   <a-input v-model:value="field.transformPattern" :placeholder="field.transformType === 'regex' ? '正则 (e.g. Price: (\\d+))' : '匹配正则'" size="small" />
                                </div>
                                <div class="form-item" style="flex: 1" v-if="field.transformType === 'replace'">
                                   <a-input v-model:value="field.transformReplacement" placeholder="替换值 (留空删除)" size="small" />
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </transition-group>

                 <a-button type="dashed" block class="add-field-btn" @click="addField">
                   <PlusOutlined /> 添加新字段
                 </a-button>
              </div>
            </div>
          </a-tab-pane>

          <!-- Data Preview Tab -->
          <a-tab-pane key="data">
            <template #tab>
               <span class="tab-label">
                <EyeOutlined />
                数据预览
              </span>
            </template>
            <div class="config-content data-tab-content">
               <div class="data-toolbar">
                  <div class="toolbar-left">
                     <span class="mode-label">采集模式:</span>
                     <a-radio-group v-model:value="listMode" size="small" button-style="solid">
                        <a-radio-button :value="false">单条</a-radio-button>
                        <a-radio-button :value="true">列表</a-radio-button>
                     </a-radio-group>
                  </div>
                  <div class="toolbar-right">
                     <a-tag color="blue">{{ previewCountText }}</a-tag>
                     <a-button type="text" size="small" @click="refreshPreview" :loading="loading"><ReloadOutlined /></a-button>
                  </div>
               </div>

               <div v-if="listMode" class="list-selector-box">
                  <div class="box-label">列表容器 (循环项)</div>
                  <a-input-search
                     v-model:value="listSelector"
                     placeholder="CSS 选择器 (例如 .product-item)"
                     enter-button="智能检测"
                     size="small"
                     @search="detectListSelector"
                  />
               </div>

               <div class="preview-display">
                  <div class="display-controls">
                      <a-radio-group v-model:value="previewViewMode" size="small">
                        <a-radio-button value="json">JSON</a-radio-button>
                        <a-radio-button value="table">表格</a-radio-button>
                      </a-radio-group>
                      
                      <a-dropdown>
                        <template #overlay>
                          <a-menu>
                            <a-menu-item @click="exportData('json')"><FileTextOutlined /> 导出 JSON</a-menu-item>
                            <a-menu-item @click="exportData('csv')"><TableOutlined /> 导出 CSV</a-menu-item>
                          </a-menu>
                        </template>
                        <a-button size="small">导出 <DownOutlined /></a-button>
                      </a-dropdown>

                      <a-button size="small" @click="copyPreviewData" :disabled="!hasPreviewData">
                        <CopyOutlined /> 复制
                      </a-button>
                  </div>
                  
                  <div class="display-area custom-scroll">
                     <div v-if="previewViewMode === 'json'" class="json-view">
                        <div v-if="!hasPreviewData" class="no-data">暂无数据</div>
                        <pre v-else>{{ previewDataJson }}</pre>
                     </div>
                     <div v-else class="table-view">
                        <a-table
                          v-if="hasPreviewData"
                          :dataSource="listMode ? previewResult : [previewResult]"
                          :columns="tableColumns"
                          size="small"
                          :pagination="{ pageSize: 20, size: 'small' }"
                          :scroll="{ x: 'max-content', y: 400 }"
                        />
                         <div v-else class="no-data">暂无数据</div>
                     </div>
                  </div>
               </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="task">
            <template #tab>
              <span class="tab-label">
                <PlayCircleOutlined />
                任务执行
              </span>
            </template>

            <div class="config-content task-tab-content">
              <div class="task-section">
                <div class="task-section-title">起始 URL</div>
                <a-textarea
                  v-model:value="startUrlsText"
                  placeholder="每行一个 URL；留空则使用当前 URL"
                  :auto-size="{ minRows: 4, maxRows: 8 }"
                />
                <div class="task-actions-row">
                  <a-button size="small" @click="useCurrentUrlAsStart" :disabled="!targetUrl">
                    使用当前 URL
                  </a-button>
                  <a-button size="small" @click="importStartUrlsToQueue">
                    导入到队列
                  </a-button>
                  <a-button size="small" danger @click="clearCrawlQueue" :disabled="crawlQueue.length === 0">
                    清空队列
                  </a-button>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">执行参数</div>
                <div class="task-grid">
                  <div class="task-grid-item">
                    <div class="task-label">最大抓取页数</div>
                    <a-input-number v-model:value="crawlMaxPages" :min="1" :max="10000" style="width: 100%" />
                  </div>
                  <div class="task-grid-item">
                    <div class="task-label">并发</div>
                    <a-input-number v-model:value="crawlConcurrency" :min="1" :max="8" style="width: 100%" />
                  </div>
                  <div class="task-grid-item">
                    <div class="task-label">请求间隔(ms)</div>
                    <a-input-number v-model:value="crawlDelayMs" :min="0" :max="60000" style="width: 100%" />
                  </div>
                  <div class="task-grid-item">
                    <div class="task-label">失败重试</div>
                    <a-input-number v-model:value="crawlRetry" :min="0" :max="10" style="width: 100%" />
                  </div>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">链接发现 / 分页</div>
                <div class="task-subgrid">
                  <div class="task-subgrid-item">
                    <div class="task-label">发现链接选择器</div>
                    <a-input v-model:value="discoverLinksSelector" placeholder="例如 a.detail-link" />
                  </div>
                  <div class="task-subgrid-item">
                    <div class="task-label">链接属性</div>
                    <a-select v-model:value="discoverLinksAttr" style="width: 100%">
                      <a-select-option value="href">href</a-select-option>
                      <a-select-option value="src">src</a-select-option>
                      <a-select-option value="custom">custom</a-select-option>
                    </a-select>
                  </div>
                  <div class="task-subgrid-item" v-if="discoverLinksAttr === 'custom'">
                    <div class="task-label">自定义属性名</div>
                    <a-input v-model:value="discoverLinksCustomAttr" placeholder="例如 data-url" />
                  </div>
                </div>

                <div class="task-subgrid" style="margin-top: 12px">
                  <div class="task-subgrid-item">
                    <div class="task-label">下一页选择器</div>
                    <a-input v-model:value="nextPageSelector" placeholder="例如 a.next" />
                  </div>
                  <div class="task-subgrid-item">
                    <div class="task-label">下一页属性</div>
                    <a-select v-model:value="nextPageAttr" style="width: 100%">
                      <a-select-option value="href">href</a-select-option>
                      <a-select-option value="custom">custom</a-select-option>
                    </a-select>
                  </div>
                  <div class="task-subgrid-item" v-if="nextPageAttr === 'custom'">
                    <div class="task-label">自定义属性名</div>
                    <a-input v-model:value="nextPageCustomAttr" placeholder="例如 data-next" />
                  </div>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">运行</div>
                <div class="task-actions-row">
                  <a-button type="primary" @click="startCrawl" :loading="crawlRunning" :disabled="crawlRunning">
                    <template #icon><PlayCircleOutlined /></template>
                    开始
                  </a-button>
                  <a-button @click="togglePauseCrawl" :disabled="!crawlRunning">
                    {{ crawlPaused ? '继续' : '暂停' }}
                  </a-button>
                  <a-button danger @click="stopCrawl" :disabled="!crawlRunning">
                    <template #icon><StopOutlined /></template>
                    停止
                  </a-button>
                  <a-button @click="clearCrawlResults" :disabled="crawlResults.length === 0">
                    清空结果
                  </a-button>
                  <a-popover placement="bottom" trigger="click">
                    <template #content>
                      <div class="task-popover">
                        <div class="task-popover-row">
                          <div class="task-label">结果去重</div>
                          <a-switch v-model:checked="crawlDedupEnabled" />
                        </div>
                        <div class="task-popover-row" v-if="crawlDedupEnabled">
                          <div class="task-label">去重字段</div>
                          <a-select v-model:value="crawlDedupKey" style="width: 220px" :options="crawlDedupKeyOptions" />
                        </div>
                        <div class="task-popover-row">
                          <div class="task-label">启动前清空结果</div>
                          <a-switch v-model:checked="crawlClearOnStart" />
                        </div>
                      </div>
                    </template>
                    <a-button>更多设置</a-button>
                  </a-popover>
                  <a-dropdown>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item @click="exportCrawlData('json')"><FileTextOutlined /> 导出 JSON</a-menu-item>
                        <a-menu-item @click="exportCrawlData('csv')"><TableOutlined /> 导出 CSV</a-menu-item>
                      </a-menu>
                    </template>
                    <a-button :disabled="crawlResults.length === 0">导出 <DownOutlined /></a-button>
                  </a-dropdown>
                </div>
                <div class="task-stats-row">
                  <a-tag color="blue">队列: {{ crawlQueue.length }}</a-tag>
                  <a-tag color="geekblue">已抓取: {{ crawlProcessed }}</a-tag>
                  <a-tag color="green">结果: {{ crawlResults.length }}</a-tag>
                  <a-tag v-if="crawlFailures.length" color="red">失败: {{ crawlFailures.length }}</a-tag>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">任务面板</div>
                <a-collapse :bordered="false">
                  <a-collapse-panel key="q" header="队列 / 正在抓取">
                    <div class="task-panel-grid">
                      <div class="task-panel-col">
                        <div class="task-panel-title">正在抓取</div>
                        <a-list size="small" bordered :data-source="crawlActiveUrls" :locale="{ emptyText: '无' }">
                          <template #renderItem="{ item }">
                            <a-list-item>{{ item }}</a-list-item>
                          </template>
                        </a-list>
                      </div>
                      <div class="task-panel-col">
                        <div class="task-panel-title">待抓取队列</div>
                        <a-list size="small" bordered :data-source="crawlQueuePreview" :locale="{ emptyText: '无' }">
                          <template #renderItem="{ item }">
                            <a-list-item>{{ item }}</a-list-item>
                          </template>
                        </a-list>
                      </div>
                    </div>
                  </a-collapse-panel>
                  <a-collapse-panel key="f" header="失败记录">
                    <div class="task-actions-row" style="margin-top: 0">
                      <a-button size="small" @click="clearCrawlFailures" :disabled="crawlFailures.length === 0">清空失败</a-button>
                      <a-button size="small" @click="exportCrawlFailures" :disabled="crawlFailures.length === 0">导出失败 JSON</a-button>
                    </div>
                    <a-table
                      v-if="crawlFailures.length"
                      :dataSource="crawlFailures"
                      :columns="crawlFailureColumns"
                      size="small"
                      :pagination="{ pageSize: 10, size: 'small' }"
                      :scroll="{ x: 'max-content', y: 260 }"
                      rowKey="id"
                    />
                    <div v-else class="task-empty">暂无失败</div>
                  </a-collapse-panel>
                  <a-collapse-panel key="l" header="运行日志">
                    <div class="task-actions-row" style="margin-top: 0">
                      <a-button size="small" @click="clearCrawlLogs" :disabled="crawlLogs.length === 0">清空日志</a-button>
                    </div>
                    <div class="task-log-box">
                      <div v-if="crawlLogs.length === 0" class="task-empty" style="margin: 0">暂无日志</div>
                      <div v-else>
                        <div v-for="(line, idx) in crawlLogs" :key="idx" class="task-log-line">{{ line }}</div>
                      </div>
                    </div>
                  </a-collapse-panel>
                </a-collapse>
              </div>

              <div class="task-section" style="padding-bottom: 8px">
                <div class="task-section-title">结果预览</div>
                <a-table
                  v-if="crawlResults.length"
                  :dataSource="crawlResults"
                  :columns="crawlTableColumns"
                  size="small"
                  :pagination="{ pageSize: 20, size: 'small' }"
                  :scroll="{ x: 'max-content', y: 420 }"
                  rowKey="__rowKey"
                />
                <div v-else class="task-empty">暂无结果</div>
              </div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </div>

    <!-- Settings Drawer -->
    <a-drawer
      v-model:open="settingsVisible"
      title="请求配置"
      placement="right"
      width="360"
      :headerStyle="{ borderBottom: '1px solid #f0f0f0' }"
      :bodyStyle="{ padding: '20px' }"
    >
      <a-form layout="vertical">
        <a-form-item label="请求超时 (毫秒)">
          <a-input-number v-model:value="requestTimeout" style="width: 100%" />
        </a-form-item>

        <a-form-item label="代理 (Proxy URL，可选)">
          <a-input v-model:value="proxyUrl" placeholder="例如 http://127.0.0.1:7890" />
        </a-form-item>

        <a-form-item label="忽略证书错误">
          <a-switch v-model:checked="acceptInvalidCerts" />
        </a-form-item>

        <a-form-item label="选取模式体验">
          <div class="pick-settings">
            <div class="pick-setting-row">
              <div class="pick-setting-label">选中后自动退出选取</div>
              <a-switch v-model:checked="autoExitOnPick" />
            </div>
            <div class="pick-setting-row">
              <div class="pick-setting-label">选中后自动切到下一个字段</div>
              <a-switch v-model:checked="autoAdvanceOnPick" />
            </div>
          </div>
        </a-form-item>
        
        <div class="section-divider">请求头 (Headers)</div>
        <div class="headers-list">
           <div v-for="(header, index) in requestHeaders" :key="index" class="header-row">
              <a-input v-model:value="header.key" placeholder="Key" class="header-input" />
              <span class="colon">:</span>
              <a-input v-model:value="header.value" placeholder="Value" class="header-input" />
              <a-button type="text" danger size="small" @click="removeHeader(index)">
                <DeleteOutlined />
              </a-button>
           </div>
        </div>
        <a-button type="dashed" block @click="addHeader" style="margin-top: 10px">
          <PlusOutlined /> 添加 Header
        </a-button>
      </a-form>
    </a-drawer>

    <!-- Code Generation Modal -->
    <a-modal
      v-model:open="codeModalVisible"
      title="代码生成"
      width="800px"
      :footer="null"
      class="code-modal"
    >
      <div class="code-modal-body">
        <div class="code-toolbar">
          <a-radio-group v-model:value="codeLanguage" button-style="solid">
            <a-radio-button value="node">Node.js (Cheerio)</a-radio-button>
            <a-radio-button value="python">Python (BS4)</a-radio-button>
          </a-radio-group>
          <div class="code-actions">
             <a-button @click="copyCode"><CopyOutlined /> 复制</a-button>
             <a-button type="primary" @click="downloadCode"><DownloadOutlined /> 下载文件</a-button>
          </div>
        </div>
        <div class="code-editor-container">
          <pre><code>{{ generatedCode }}</code></pre>
        </div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="templateModalVisible"
      :title="templateModalMode === 'save' ? '保存为本地模板' : '加载本地模板'"
      width="520px"
      :okText="templateModalMode === 'save' ? '保存' : '加载'"
      @ok="templateModalMode === 'save' ? confirmSaveTemplate() : confirmLoadTemplate()"
    >
      <div v-if="templateModalMode === 'save'" class="template-modal-body">
        <a-form layout="vertical">
          <a-form-item label="模板名称">
            <a-input v-model:value="templateNameInput" placeholder="例如 电商列表-详情" />
          </a-form-item>
        </a-form>
      </div>
      <div v-else class="template-modal-body">
        <a-form layout="vertical">
          <a-form-item label="选择模板">
            <a-select v-model:value="selectedTemplateId" :options="templateOptions" placeholder="请选择" />
          </a-form-item>
          <div class="template-load-actions">
            <a-button danger @click="deleteSelectedTemplate" :disabled="!selectedTemplateId">删除该模板</a-button>
          </div>
        </a-form>
      </div>
    </a-modal>

    <a-modal
      v-model:open="helpModalVisible"
      title="使用说明"
      width="860px"
      :footer="null"
    >
      <div class="help-modal-body">
        <h3>快速流程</h3>
        <ol>
          <li>输入 URL，点击「加载页面」</li>
          <li>切换到「选取模式」，在预览页点击元素生成选择器</li>
          <li>在「字段配置」里配置字段名、属性类型与清洗规则</li>
          <li>在「数据预览」里验证单条/列表提取结果</li>
          <li>在「任务执行」里批量抓取并导出 JSON/CSV 或「生成代码」导出脚本</li>
        </ol>

        <h3>顶部按钮</h3>
        <ul>
          <li><b>加载页面</b>：请求网页并在左侧 iframe 展示，同时更新预览解析源 HTML。</li>
          <li><b>请求设置</b>：配置 Headers、超时、代理、证书策略，影响加载与任务执行。</li>
          <li><b>生成代码</b>：生成 Node.js(Cheerio)/Python(BS4) 脚本。</li>
          <li><b>规则管理</b>：导入/导出规则配置；保存/加载本地模板。</li>
        </ul>

        <h3>字段配置</h3>
        <ul>
          <li><b>selector</b>：CSS 选择器，来自选取模式或手动填写。</li>
          <li><b>属性</b>：text/html/href/src/custom。</li>
          <li><b>清洗</b>：trim/regex/replace。</li>
          <li><b>准星按钮</b>：在预览页高亮该选择器，快速确认是否选对。</li>
        </ul>

        <h3>数据预览</h3>
        <ul>
          <li><b>单条模式</b>：整页提取 1 条数据对象。</li>
          <li><b>列表模式</b>：通过 listSelector 找到列表项，对每个 item 提取字段。</li>
        </ul>

        <h3>任务执行</h3>
        <ul>
          <li><b>起始 URL</b>：每行一个 URL，可导入队列。</li>
          <li><b>并发/间隔/重试</b>：控制抓取速度与稳定性。</li>
          <li><b>链接发现</b>：从页面中按选择器提取链接并加入队列。</li>
          <li><b>下一页</b>：按选择器提取下一页链接并加入队列。</li>
          <li><b>暂停/继续</b>：临时暂停请求，继续后恢复。</li>
          <li><b>更多设置</b>：结果去重、启动前清空结果/日志/失败等。</li>
          <li><b>任务面板</b>：查看正在抓取、待抓取队列、失败记录与运行日志。</li>
        </ul>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import { 
  GlobalOutlined, 
  AimOutlined, 
  CodeOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  CopyOutlined,
  DownloadOutlined,
  SettingOutlined,
  TableOutlined,
  FileTextOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  MobileOutlined,
  DesktopOutlined,
  ProfileOutlined,
  EyeOutlined,
  HistoryOutlined,
  ClearOutlined,
  LinkOutlined,
  ReloadOutlined,
  DownOutlined,
  PlayCircleOutlined,
  StopOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue';
import { fetch } from '@tauri-apps/plugin-http';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

// --- State ---
const targetUrl = ref('');
const requestMethod = ref('GET');
const loading = ref(false);
const rawHtml = ref('');
const processedHtml = ref('');
const previewFrame = ref(null);
const urlInputRef = ref(null);
const isInspectorActive = ref(false);
const isMobileView = ref(false);
const activeTab = ref('fields');

// --- URL History ---
const urlHistory = ref([]);
const URL_HISTORY_KEY = 'scraper:urlHistory:v1';
const MAX_URL_HISTORY = 20;

// --- Advanced Settings ---
const settingsVisible = ref(false);
const requestHeaders = ref([
  { key: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
]);
const requestTimeout = ref(10000);
const proxyUrl = ref('');
const acceptInvalidCerts = ref(false);

const autoExitOnPick = ref(false);
const autoAdvanceOnPick = ref(false);
const PICK_SETTINGS_KEY = 'scraper:pickSettings:v1';

// --- Data Preview Options ---
const previewViewMode = ref('json'); // 'json' | 'table'

const fields = reactive([
  { 
    name: 'title', 
    selector: 'h1', 
    attr: 'text', 
    customAttr: '',
    transformType: 'none',
    transformPattern: '',
    transformReplacement: ''
  }
]);
const currentFieldIndex = ref(0);

const listMode = ref(false);
const listSelector = ref('');

const codeModalVisible = ref(false);
const codeLanguage = ref('node');

const helpModalVisible = ref(false);

const templateModalVisible = ref(false);
const templateModalMode = ref('save');
const templateNameInput = ref('');
const selectedTemplateId = ref('');
const templates = ref([]);
const TEMPLATES_KEY = 'scraper:templates:v1';
const LAST_CONFIG_KEY = 'scraper:lastConfig:v2';

const startUrlsText = ref('');
const crawlQueue = ref([]);
const crawlResults = ref([]);
const crawlRunning = ref(false);
const crawlProcessed = ref(0);
const crawlMaxPages = ref(200);
const crawlConcurrency = ref(2);
const crawlDelayMs = ref(300);
const crawlRetry = ref(1);
const discoverLinksSelector = ref('');
const discoverLinksAttr = ref('href');
const discoverLinksCustomAttr = ref('');
const nextPageSelector = ref('');
const nextPageAttr = ref('href');
const nextPageCustomAttr = ref('');
const crawlRunId = ref(0);

const crawlPaused = ref(false);
const crawlActiveUrls = ref([]);
const crawlFailures = ref([]);
const crawlLogs = ref([]);
const crawlDedupEnabled = ref(true);
const crawlDedupKey = ref('__url');
const crawlClearOnStart = ref(false);

const loadUrlHistory = () => {
  try {
    const raw = localStorage.getItem(URL_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    urlHistory.value = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (e) {
    urlHistory.value = [];
  }
};

const saveUrlHistory = () => {
  try {
    localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(urlHistory.value.slice(0, MAX_URL_HISTORY)));
  } catch (e) {
    // ignore
  }
};

const normalizedUrl = (input) => {
  const str = (input || '').trim();
  if (!str) return '';
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  return 'https://' + str;
};

const parseCharsetFromContentType = (contentType) => {
  const ct = (contentType || '').toLowerCase();
  const m = ct.match(/charset\s*=\s*([^;\s]+)/i);
  return m ? String(m[1]).trim().toLowerCase() : '';
};

const parseCharsetFromHtmlMeta = (html) => {
  const s = String(html || '');
  const m1 = s.match(/<meta[^>]+charset\s*=\s*['\"]?([^'\"\s>]+)/i);
  if (m1) return String(m1[1]).trim().toLowerCase();
  const m2 = s.match(/<meta[^>]+http-equiv\s*=\s*['\"]content-type['\"][^>]*content\s*=\s*['\"][^'\"]*charset\s*=\s*([^'\"\s;>]+)/i);
  if (m2) return String(m2[1]).trim().toLowerCase();
  return '';
};

const normalizeDecoderLabel = (charset) => {
  const c = (charset || '').toLowerCase();
  if (!c) return '';
  if (c === 'gbk' || c === 'gb2312' || c === 'gb-2312') return 'gb18030';
  if (c === 'gb18030') return 'gb18030';
  return c;
};

const decodeHtmlFromResponse = async (response) => {
  try {
    const buf = await response.arrayBuffer();
    const ct = response.headers?.get ? response.headers.get('content-type') : '';
    const headerCharset = normalizeDecoderLabel(parseCharsetFromContentType(ct));

    const decodeWith = (label) => {
      try {
        return new TextDecoder(label || 'utf-8').decode(buf);
      } catch (_) {
        return new TextDecoder('utf-8').decode(buf);
      }
    };

    if (headerCharset) return decodeWith(headerCharset);

    try {
      const headBuf = buf.slice(0, 4096);
      const latin1 = new TextDecoder('iso-8859-1').decode(headBuf);
      const sniffed = normalizeDecoderLabel(parseCharsetFromHtmlMeta(latin1) || parseCharsetFromContentType(latin1));
      if (sniffed) return decodeWith(sniffed);
    } catch (_) {
      // ignore
    }

    const utf8Text = decodeWith('utf-8');
    const metaCharset = normalizeDecoderLabel(parseCharsetFromHtmlMeta(utf8Text));
    if (metaCharset && metaCharset !== 'utf-8') {
      return decodeWith(metaCharset);
    }

    const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;
    if (replacementCount > 20) {
      const gbText = decodeWith('gb18030');
      return gbText || utf8Text;
    }
    return utf8Text;
  } catch (_) {
    return await response.text();
  }
};

const safeResolveUrl = (baseUrl, maybeUrl) => {
  const raw = (maybeUrl || '').trim();
  if (!raw) return raw;
  try {
    return new URL(raw, baseUrl).toString();
  } catch (_) {
    return raw;
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms || 0)));

const pushCrawlLog = (text) => {
  const line = `[${new Date().toLocaleTimeString()}] ${text}`;
  crawlLogs.value.push(line);
  if (crawlLogs.value.length > 500) crawlLogs.value.splice(0, crawlLogs.value.length - 500);
};

const clearCrawlLogs = () => {
  crawlLogs.value = [];
};

const clearCrawlFailures = () => {
  crawlFailures.value = [];
};

const exportCrawlFailures = () => {
  if (!crawlFailures.value.length) return;
  downloadFile('crawl-failures.json', JSON.stringify(crawlFailures.value, null, 2));
};

const canFetch = computed(() => {
  return !loading.value && !!(targetUrl.value || '').trim();
});

const crawlFailureColumns = computed(() => {
  return [
    { title: '时间', dataIndex: 'time', key: 'time', width: 110 },
    { title: 'URL', dataIndex: 'url', key: 'url' },
    { title: '错误', dataIndex: 'error', key: 'error' }
  ];
});

const crawlQueuePreview = computed(() => {
  return (crawlQueue.value || []).slice(0, 30);
});

const crawlDedupKeyOptions = computed(() => {
  const opts = [
    { label: '__url', value: '__url' }
  ];
  fields.filter(f => f && f.name).forEach(f => {
    opts.push({ label: f.name, value: f.name });
  });
  return opts;
});

const pasteUrl = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    targetUrl.value = text.trim();
  } catch (e) {
    message.error('粘贴失败（可能无权限）');
  }
};

const clearTargetUrl = () => {
  targetUrl.value = '';
};

const openInBrowser = () => {
  const u = normalizedUrl(targetUrl.value);
  if (!u) return;
  window.open(u, '_blank');
};

const addToHistory = (url) => {
  const u = normalizedUrl(url);
  if (!u) return;
  urlHistory.value = [u, ...urlHistory.value.filter(x => x !== u)].slice(0, MAX_URL_HISTORY);
  saveUrlHistory();
};

const clearUrlHistory = () => {
  urlHistory.value = [];
  saveUrlHistory();
  message.success('已清空 URL 历史');
};

const urlHistoryOptions = computed(() => {
  const q = (targetUrl.value || '').trim().toLowerCase();
  const list = q ? urlHistory.value.filter(u => u.toLowerCase().includes(q)) : urlHistory.value;
  return list.slice(0, 8).map(u => ({ value: u }));
});

const onSelectHistoryUrl = (value) => {
  targetUrl.value = value;
};

// --- Settings Logic ---
const addHeader = () => {
  requestHeaders.value.push({ key: '', value: '' });
};

const removeHeader = (index) => {
  requestHeaders.value.splice(index, 1);
};

const cloneFields = () => {
  try {
    return JSON.parse(JSON.stringify(fields));
  } catch (_) {
    return fields.map(f => ({ ...f }));
  }
};

const normalizeFields = (arr) => {
  const list = Array.isArray(arr) ? arr : [];
  return list.map((f, idx) => ({
    name: typeof f?.name === 'string' ? f.name : `field_${idx + 1}`,
    selector: typeof f?.selector === 'string' ? f.selector : '',
    attr: typeof f?.attr === 'string' ? f.attr : 'text',
    customAttr: typeof f?.customAttr === 'string' ? f.customAttr : '',
    transformType: typeof f?.transformType === 'string' ? f.transformType : 'none',
    transformPattern: typeof f?.transformPattern === 'string' ? f.transformPattern : '',
    transformReplacement: typeof f?.transformReplacement === 'string' ? f.transformReplacement : ''
  }));
};

const cloneHeaders = () => {
  const list = Array.isArray(requestHeaders.value) ? requestHeaders.value : [];
  return list.map(h => ({
    key: typeof h?.key === 'string' ? h.key : '',
    value: typeof h?.value === 'string' ? h.value : ''
  }));
};

const getCurrentConfigSnapshot = () => {
  return {
    targetUrl: targetUrl.value,
    requestMethod: requestMethod.value,
    fields: cloneFields(),
    listMode: listMode.value,
    listSelector: listSelector.value,
    headers: cloneHeaders(),
    requestTimeout: requestTimeout.value,
    proxyUrl: proxyUrl.value,
    acceptInvalidCerts: acceptInvalidCerts.value,
    autoExitOnPick: autoExitOnPick.value,
    autoAdvanceOnPick: autoAdvanceOnPick.value,

    startUrlsText: startUrlsText.value,
    crawlMaxPages: crawlMaxPages.value,
    crawlConcurrency: crawlConcurrency.value,
    crawlDelayMs: crawlDelayMs.value,
    crawlRetry: crawlRetry.value,
    discoverLinksSelector: discoverLinksSelector.value,
    discoverLinksAttr: discoverLinksAttr.value,
    discoverLinksCustomAttr: discoverLinksCustomAttr.value,
    nextPageSelector: nextPageSelector.value,
    nextPageAttr: nextPageAttr.value,
    nextPageCustomAttr: nextPageCustomAttr.value,

    crawlDedupEnabled: crawlDedupEnabled.value,
    crawlDedupKey: crawlDedupKey.value,
    crawlClearOnStart: crawlClearOnStart.value
  };
};

const applyConfigSnapshot = (config) => {
  if (!config || typeof config !== 'object') return;
  if (typeof config.targetUrl === 'string') targetUrl.value = config.targetUrl;
  if (typeof config.requestMethod === 'string') requestMethod.value = config.requestMethod;
  if (Array.isArray(config.fields)) {
    fields.length = 0;
    fields.push(...normalizeFields(config.fields));
  }
  if (typeof config.listMode === 'boolean') listMode.value = config.listMode;
  if (typeof config.listSelector === 'string') listSelector.value = config.listSelector;
  if (Array.isArray(config.headers)) requestHeaders.value = config.headers;
  if (typeof config.requestTimeout === 'number') requestTimeout.value = config.requestTimeout;
  if (typeof config.proxyUrl === 'string') proxyUrl.value = config.proxyUrl;
  if (typeof config.acceptInvalidCerts === 'boolean') acceptInvalidCerts.value = config.acceptInvalidCerts;
  if (typeof config.autoExitOnPick === 'boolean') autoExitOnPick.value = config.autoExitOnPick;
  if (typeof config.autoAdvanceOnPick === 'boolean') autoAdvanceOnPick.value = config.autoAdvanceOnPick;

  if (typeof config.startUrlsText === 'string') startUrlsText.value = config.startUrlsText;
  if (typeof config.crawlMaxPages === 'number') crawlMaxPages.value = config.crawlMaxPages;
  if (typeof config.crawlConcurrency === 'number') crawlConcurrency.value = config.crawlConcurrency;
  if (typeof config.crawlDelayMs === 'number') crawlDelayMs.value = config.crawlDelayMs;
  if (typeof config.crawlRetry === 'number') crawlRetry.value = config.crawlRetry;
  if (typeof config.discoverLinksSelector === 'string') discoverLinksSelector.value = config.discoverLinksSelector;
  if (typeof config.discoverLinksAttr === 'string') discoverLinksAttr.value = config.discoverLinksAttr;
  if (typeof config.discoverLinksCustomAttr === 'string') discoverLinksCustomAttr.value = config.discoverLinksCustomAttr;
  if (typeof config.nextPageSelector === 'string') nextPageSelector.value = config.nextPageSelector;
  if (typeof config.nextPageAttr === 'string') nextPageAttr.value = config.nextPageAttr;
  if (typeof config.nextPageCustomAttr === 'string') nextPageCustomAttr.value = config.nextPageCustomAttr;

  if (typeof config.crawlDedupEnabled === 'boolean') crawlDedupEnabled.value = config.crawlDedupEnabled;
  if (typeof config.crawlDedupKey === 'string') crawlDedupKey.value = config.crawlDedupKey;
  if (typeof config.crawlClearOnStart === 'boolean') crawlClearOnStart.value = config.crawlClearOnStart;
};

const loadTemplates = () => {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    templates.value = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    templates.value = [];
  }
};

const saveTemplates = () => {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.value || []));
  } catch (_) {}
};

const templateOptions = computed(() => {
  return (templates.value || []).map(t => ({ label: t.name, value: t.id }));
});

const openSaveTemplate = () => {
  templateModalMode.value = 'save';
  templateNameInput.value = '';
  templateModalVisible.value = true;
};

const openLoadTemplate = () => {
  templateModalMode.value = 'load';
  selectedTemplateId.value = '';
  templateModalVisible.value = true;
};

const confirmSaveTemplate = () => {
  const name = (templateNameInput.value || '').trim();
  if (!name) {
    message.warning('请输入模板名称');
    return;
  }
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const snapshot = getCurrentConfigSnapshot();
  templates.value = [{ id, name, snapshot, updatedAt: Date.now() }, ...(templates.value || [])];
  saveTemplates();
  templateModalVisible.value = false;
  message.success('模板已保存');
};

const confirmLoadTemplate = () => {
  const id = selectedTemplateId.value;
  const tpl = (templates.value || []).find(t => t.id === id);
  if (!tpl) {
    message.warning('请选择模板');
    return;
  }
  applyConfigSnapshot(tpl.snapshot);
  templateModalVisible.value = false;
  scheduleRefreshPreview();
  message.success('模板已加载');
};

const deleteSelectedTemplate = () => {
  const id = selectedTemplateId.value;
  if (!id) return;
  templates.value = (templates.value || []).filter(t => t.id !== id);
  saveTemplates();
  selectedTemplateId.value = '';
  message.success('模板已删除');
};

const autosaveTimer = ref(null);
const scheduleAutosave = () => {
  if (autosaveTimer.value) clearTimeout(autosaveTimer.value);
  autosaveTimer.value = setTimeout(() => {
    try {
      localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(getCurrentConfigSnapshot()));
    } catch (_) {}
  }, 400);
};

watch(
  () => getCurrentConfigSnapshot(),
  () => scheduleAutosave(),
  { deep: true }
);

// --- Import/Export Logic ---
const fileInput = ref(null);

const exportRules = () => {
  const config = {
    targetUrl: targetUrl.value,
    requestMethod: requestMethod.value,
    fields: cloneFields(),
    listMode: listMode.value,
    listSelector: listSelector.value,
    headers: cloneHeaders(),
    requestTimeout: requestTimeout.value,
    proxyUrl: proxyUrl.value,
    acceptInvalidCerts: acceptInvalidCerts.value,

    startUrlsText: startUrlsText.value,
    crawlMaxPages: crawlMaxPages.value,
    crawlConcurrency: crawlConcurrency.value,
    crawlDelayMs: crawlDelayMs.value,
    crawlRetry: crawlRetry.value,
    discoverLinksSelector: discoverLinksSelector.value,
    discoverLinksAttr: discoverLinksAttr.value,
    discoverLinksCustomAttr: discoverLinksCustomAttr.value,
    nextPageSelector: nextPageSelector.value,
    nextPageAttr: nextPageAttr.value,
    nextPageCustomAttr: nextPageCustomAttr.value
  };
  downloadFile('scraper-rules.json', JSON.stringify(config, null, 2));
};

const triggerImport = () => {
  fileInput.value.click();
};

const importRules = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);
      if (config.targetUrl) targetUrl.value = config.targetUrl;
      if (config.requestMethod) requestMethod.value = config.requestMethod;
      if (config.fields) {
        fields.length = 0;
        fields.push(...normalizeFields(config.fields));
      }
      if (config.listMode !== undefined) listMode.value = config.listMode;
      if (config.listSelector) listSelector.value = config.listSelector;
      if (config.headers) requestHeaders.value = config.headers;

      if (typeof config.requestTimeout === 'number') requestTimeout.value = config.requestTimeout;
      if (typeof config.proxyUrl === 'string') proxyUrl.value = config.proxyUrl;
      if (typeof config.acceptInvalidCerts === 'boolean') acceptInvalidCerts.value = config.acceptInvalidCerts;

      if (typeof config.startUrlsText === 'string') startUrlsText.value = config.startUrlsText;
      if (typeof config.crawlMaxPages === 'number') crawlMaxPages.value = config.crawlMaxPages;
      if (typeof config.crawlConcurrency === 'number') crawlConcurrency.value = config.crawlConcurrency;
      if (typeof config.crawlDelayMs === 'number') crawlDelayMs.value = config.crawlDelayMs;
      if (typeof config.crawlRetry === 'number') crawlRetry.value = config.crawlRetry;
      if (typeof config.discoverLinksSelector === 'string') discoverLinksSelector.value = config.discoverLinksSelector;
      if (typeof config.discoverLinksAttr === 'string') discoverLinksAttr.value = config.discoverLinksAttr;
      if (typeof config.discoverLinksCustomAttr === 'string') discoverLinksCustomAttr.value = config.discoverLinksCustomAttr;
      if (typeof config.nextPageSelector === 'string') nextPageSelector.value = config.nextPageSelector;
      if (typeof config.nextPageAttr === 'string') nextPageAttr.value = config.nextPageAttr;
      if (typeof config.nextPageCustomAttr === 'string') nextPageCustomAttr.value = config.nextPageCustomAttr;
      
      message.success('规则导入成功');
      refreshPreview();
    } catch (err) {
      message.error('规则文件解析失败');
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset
};

const exportData = (type) => {
  if (!previewResult.value) return;
  
  if (type === 'json') {
    downloadFile('data.json', JSON.stringify(previewResult.value, null, 2));
  } else if (type === 'csv') {
    // Simple CSV conversion
    let data = Array.isArray(previewResult.value) ? previewResult.value : [previewResult.value];
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(fieldName => {
        let val = row[fieldName] || '';
        val = String(val).replace(/"/g, '""'); // Escape quotes
        return `"${val}"`;
      }).join(','))
    ].join('\n');
    
    downloadFile('data.csv', csvContent, 'text/csv');
  }
};

const downloadFile = (filename, content, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const parseStartUrls = () => {
  const text = (startUrlsText.value || '').trim();
  const list = text
    ? text.split(/\r?\n/).map(x => normalizedUrl(x)).filter(Boolean)
    : (targetUrl.value ? [normalizedUrl(targetUrl.value)] : []);
  return Array.from(new Set(list));
};

const enqueueUrls = (urls) => {
  const set = new Set(crawlQueue.value);
  (urls || []).forEach(u => {
    const nu = normalizedUrl(u);
    if (!nu) return;
    if (!set.has(nu)) {
      set.add(nu);
      crawlQueue.value.push(nu);
    }
  });
};

const useCurrentUrlAsStart = () => {
  const u = normalizedUrl(targetUrl.value);
  if (!u) return;
  const current = (startUrlsText.value || '').trim();
  startUrlsText.value = current ? (current + '\n' + u) : u;
};

const importStartUrlsToQueue = () => {
  const urls = parseStartUrls();
  if (!urls.length) {
    message.warning('没有可导入的 URL');
    return;
  }
  enqueueUrls(urls);
  message.success(`已导入 ${urls.length} 个 URL 到队列`);
};

const clearCrawlQueue = () => {
  crawlQueue.value = [];
};

const clearCrawlResults = () => {
  crawlResults.value = [];
  crawlProcessed.value = 0;
};

const togglePauseCrawl = () => {
  if (!crawlRunning.value) return;
  crawlPaused.value = !crawlPaused.value;
  pushCrawlLog(crawlPaused.value ? '任务已暂停' : '任务已继续');
};

const stopCrawl = () => {
  crawlRunning.value = false;
  crawlPaused.value = false;
  crawlActiveUrls.value = [];
  crawlRunId.value += 1;
};

const getAttrValue = (el, attr, customAttr) => {
  if (!el) return '';
  if (attr === 'custom') return el.getAttribute(customAttr || '');
  return el.getAttribute(attr);
};

const extractFromDocForTask = (doc, pageUrl) => {
  if (!doc) return [];
  const results = [];
  if (listMode.value && listSelector.value) {
    const items = Array.from(doc.querySelectorAll(listSelector.value));
    items.forEach((item, idx) => {
      const row = { __url: pageUrl, __index: idx + 1 };
      fields.forEach(field => {
        if (field.name && field.selector) {
          const el = item.querySelector(field.selector);
          row[field.name] = extractValue(el, field, pageUrl);
        }
      });
      results.push(row);
    });
  } else {
    const row = { __url: pageUrl, __index: 1 };
    fields.forEach(field => {
      if (field.name && field.selector) {
        const el = doc.querySelector(field.selector);
        row[field.name] = extractValue(el, field, pageUrl);
      }
    });
    results.push(row);
  }
  return results;
};

const discoverUrlsFromDoc = (doc, pageUrl) => {
  const sel = (discoverLinksSelector.value || '').trim();
  if (!sel) return [];
  try {
    const nodes = Array.from(doc.querySelectorAll(sel));
    const urls = nodes
      .map(el => getAttrValue(el, discoverLinksAttr.value, discoverLinksCustomAttr.value))
      .filter(Boolean)
      .map(u => safeResolveUrl(pageUrl, u));
    return Array.from(new Set(urls));
  } catch (_) {
    return [];
  }
};

const getNextPageUrlFromDoc = (doc, pageUrl) => {
  const sel = (nextPageSelector.value || '').trim();
  if (!sel) {
    try {
      const links = Array.from(doc.querySelectorAll('a'));
      const preferred = links.find(a => {
        const text = (a.textContent || '').trim();
        if (!text) return false;
        return text.includes('下一章') || text.includes('下章') || text.includes('下一页') || text.includes('下页');
      });
      const href = preferred ? preferred.getAttribute('href') : '';
      return href ? safeResolveUrl(pageUrl, href) : '';
    } catch (_) {
      return '';
    }
  }
  try {
    const el = doc.querySelector(sel);
    const raw = getAttrValue(el, nextPageAttr.value, nextPageCustomAttr.value);
    return raw ? safeResolveUrl(pageUrl, raw) : '';
  } catch (_) {
    return '';
  }
};

const buildRequestHeadersObject = () => {
  const headers = {};
  (requestHeaders.value || []).forEach(h => {
    if (h.key && h.value) headers[h.key] = h.value;
  });
  return headers;
};

const fetchHtmlForTask = async (url) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: buildRequestHeadersObject(),
    connectTimeout: requestTimeout.value,
    ...(proxyUrl.value ? { proxy: { all: proxyUrl.value } } : {}),
    ...(acceptInvalidCerts.value
      ? { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } }
      : {})
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }
  return await decodeHtmlFromResponse(response);
};

const crawlTableColumns = computed(() => {
  const cols = [
    { title: '__url', dataIndex: '__url', key: '__url' },
    { title: '__index', dataIndex: '__index', key: '__index', width: 80 }
  ];
  fields
    .filter(f => f && f.name)
    .forEach(f => {
      cols.push({ title: f.name, dataIndex: f.name, key: f.name });
    });
  return cols;
});

const exportCrawlData = (type) => {
  if (!crawlResults.value || crawlResults.value.length === 0) return;

  (async () => {
    try {
      const ext = type === 'csv' ? 'csv' : 'json';
      const filePath = await save({
        defaultPath: `crawl-data.${ext}`,
        filters: [
          { name: ext.toUpperCase(), extensions: [ext] }
        ]
      });
      if (!filePath) return;

      if (type === 'json') {
        await writeTextFile(filePath, JSON.stringify(crawlResults.value, null, 2));
        message.success('导出成功');
        return;
      }

      const data = crawlResults.value;
      const headers = Array.from(new Set(data.flatMap(row => Object.keys(row || {}))));
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(k => {
          let val = row?.[k] ?? '';
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        }).join(','))
      ].join('\n');
      await writeTextFile(filePath, csvContent);
      message.success('导出成功');
    } catch (e) {
      try {
        if (type === 'json') {
          downloadFile('crawl-data.json', JSON.stringify(crawlResults.value, null, 2));
          message.info('已使用浏览器下载方式导出');
          return;
        }
        const data = crawlResults.value;
        const headers = Array.from(new Set(data.flatMap(row => Object.keys(row || {}))));
        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(k => {
            let val = row?.[k] ?? '';
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
          }).join(','))
        ].join('\n');
        downloadFile('crawl-data.csv', csvContent, 'text/csv');
        message.info('已使用浏览器下载方式导出');
      } catch (_) {
        message.error('导出失败');
      }
    }
  })();
};

const startCrawl = async () => {
  if (crawlRunning.value) return;
  const runId = crawlRunId.value + 1;
  crawlRunId.value = runId;

  if (crawlClearOnStart.value) {
    clearCrawlResults();
    clearCrawlFailures();
    clearCrawlLogs();
  }

  crawlPaused.value = false;

  const starters = parseStartUrls();
  enqueueUrls(starters);

  if (crawlQueue.value.length === 0) {
    message.warning('队列为空');
    return;
  }

  crawlRunning.value = true;
  const visited = new Set();
  const dedupSet = new Set();
  pushCrawlLog(`开始任务：并发=${crawlConcurrency.value} 间隔=${crawlDelayMs.value}ms 最大页数=${crawlMaxPages.value}`);

  const worker = async () => {
    while (crawlRunning.value && crawlRunId.value === runId) {
      if (crawlProcessed.value >= crawlMaxPages.value) break;

      while (crawlPaused.value && crawlRunning.value && crawlRunId.value === runId) {
        await sleep(150);
      }

      const url = crawlQueue.value.shift();
      if (!url) break;
      if (visited.has(url)) continue;
      visited.add(url);

      crawlActiveUrls.value = Array.from(new Set([...(crawlActiveUrls.value || []), url]));
      pushCrawlLog(`抓取: ${url}`);

      let attempt = 0;
      while (crawlRunning.value && crawlRunId.value === runId) {
        try {
          const html = await fetchHtmlForTask(url);
          const doc = new DOMParser().parseFromString(html, 'text/html');

          const rows = extractFromDocForTask(doc, url);
          rows.forEach((r, idx) => {
            if (crawlDedupEnabled.value) {
              const keyName = crawlDedupKey.value || '__url';
              const keyVal = (keyName === '__url') ? url : (r?.[keyName] ?? '');
              const dedupKeyVal = String(keyVal ?? '');
              if (dedupKeyVal && dedupSet.has(dedupKeyVal)) return;
              if (dedupKeyVal) dedupSet.add(dedupKeyVal);
            }
            crawlResults.value.push({ __rowKey: `${url}__${idx}__${Date.now()}`, ...r });
          });

          if (rows.length) pushCrawlLog(`提取结果: ${rows.length} 条`);

          const discovered = discoverUrlsFromDoc(doc, url);
          if (discovered.length) {
            enqueueUrls(discovered);
            pushCrawlLog(`发现链接: +${discovered.length}`);
          }

          const nextUrl = getNextPageUrlFromDoc(doc, url);
          if (nextUrl) {
            enqueueUrls([nextUrl]);
            pushCrawlLog(`发现下一页: ${nextUrl}`);
          }

          crawlProcessed.value += 1;
          break;
        } catch (e) {
          attempt += 1;
          if (attempt > (crawlRetry.value || 0)) {
            crawlFailures.value.push({
              id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
              time: new Date().toLocaleTimeString(),
              url,
              error: (e && e.message) ? String(e.message) : String(e)
            });
            pushCrawlLog(`失败: ${url}`);
            crawlProcessed.value += 1;
            break;
          }
          await sleep(200);
        }
      }

      crawlActiveUrls.value = (crawlActiveUrls.value || []).filter(x => x !== url);

      await sleep(crawlDelayMs.value);
    }
  };

  try {
    const n = Math.max(1, Math.min(8, crawlConcurrency.value || 1));
    await Promise.all(Array.from({ length: n }, () => worker()));
  } finally {
    if (crawlRunId.value === runId) {
      crawlRunning.value = false;
      crawlPaused.value = false;
      crawlActiveUrls.value = [];
      pushCrawlLog('任务结束');
    }
  }
};

// --- Browser & Inspector Logic ---

const formatFetchError = (err) => {
  try {
    if (!err) return '网络请求失败';
    if (typeof err === 'string') return err;
    if (err instanceof Error) {
      const parts = [];
      if (err.name) parts.push(err.name);
      if (err.message) parts.push(err.message);
      const causeMsg = typeof err.cause === 'string'
        ? err.cause
        : (err.cause && typeof err.cause === 'object' && 'message' in err.cause)
          ? err.cause.message
          : '';
      if (causeMsg) parts.push(`cause: ${causeMsg}`);
      return parts.join(' | ') || '网络请求失败';
    }
    if (typeof err === 'object') {
      const msg = err.message || err.toString?.();
      return msg || '网络请求失败';
    }
    return String(err);
  } catch (_) {
    return '网络请求失败';
  }
};

const fetchPage = async () => {
  if (!targetUrl.value) {
    message.warning('请输入目标网址');
    return;
  }

  targetUrl.value = normalizedUrl(targetUrl.value);

  loading.value = true;
  isInspectorActive.value = false;
  
  try {
    const headers = {};
    requestHeaders.value.forEach(h => {
      if (h.key && h.value) headers[h.key] = h.value;
    });

    const response = await fetch(targetUrl.value, {
      method: 'GET',
      headers: headers,
      connectTimeout: requestTimeout.value,
      ...(proxyUrl.value ? { proxy: { all: proxyUrl.value } } : {}),
      ...(acceptInvalidCerts.value
        ? { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } }
        : {})
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const html = await decodeHtmlFromResponse(response);
    rawHtml.value = html;
    processedHtml.value = injectInspectorScript(html, targetUrl.value);
    addToHistory(targetUrl.value);
    
    message.success('页面加载成功');
    scheduleRefreshPreview();
  } catch (error) {
    console.error('Scraper fetchPage error:', {
      error,
      name: error?.name,
      message: error?.message,
      cause: error?.cause,
      stack: error?.stack
    });
    message.error(`加载失败: ${formatFetchError(error)}（可能与代理/证书/DNS有关）`);
  } finally {
    loading.value = false;
  }
};

// Inject script for interaction and base tag for relative links
const injectInspectorScript = (html, baseUrl) => {
  // Add base tag
  const baseTag = `<base href="${baseUrl}" target="_blank">`;
  let processed = html;
  if (/<head[\s>]/i.test(processed)) {
    processed = processed.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  } else if (/<html[\s>]/i.test(processed)) {
    processed = processed.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
  } else {
    processed = `<head>${baseTag}</head>` + processed;
  }
  
  // Inject Inspector Script
  const script = `
    <script>
      (function() {
        let active = false;
        let highlighted = null;
        let highlightedList = [];
        
        window.addEventListener('message', (event) => {
          if (event.data.type === 'toggle-inspector') {
            active = event.data.active;
            try {
              document.documentElement.classList.toggle('scraper-inspector-active', !!active);
            } catch (e) {}
            if (!active && highlighted) {
              highlighted.style.outline = '';
              highlighted = null;
            }
          }
          if (event.data.type === 'highlight-selector') {
            try {
              highlightedList.forEach(el => { try { el.style.outline = ''; } catch (_) {} });
              highlightedList = [];
              const selector = event.data.selector;
              if (!selector) return;
              const list = Array.from(document.querySelectorAll(selector));
              list.forEach(el => { el.style.outline = '2px dashed #52c41a'; });
              highlightedList = list;
              if (list[0] && list[0].scrollIntoView) list[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
            } catch (e) {}
          }
        });

        document.addEventListener('mouseover', (e) => {
          if (!active) return;
          e.stopPropagation();
          
          if (highlighted) highlighted.style.outline = '';
          e.target.style.outline = '2px solid #1890ff';
          highlighted = e.target;
        }, true);

        document.addEventListener('mouseout', (e) => {
          if (!active) return;
          e.target.style.outline = '';
        }, true);

        document.addEventListener('click', (e) => {
          if (!active) return;
          e.preventDefault();
          e.stopPropagation();
          
          const selector = generateSelector(e.target);
          window.parent.postMessage({
            type: 'element-selected',
            selector: selector,
            tagName: e.target.tagName,
            text: e.target.innerText.slice(0, 50)
          }, '*');
        }, true);

        function generateSelector(el) {
          const tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
          if (tag === 'html') return 'html';
          if (tag === 'body') return 'body';

          function isUnique(selector) {
            try {
              return document.querySelectorAll(selector).length === 1;
            } catch (e) {
              return false;
            }
          }

          function generalizedIdSelector(tagName, id) {
            const raw = String(id || '');
            const m = raw.match(/^([a-zA-Z_-]+)_([0-9]{5,})$/);
            if (m) {
              const prefix = m[1];
              const sel = (tagName ? tagName : '') + '[id^="' + prefix + '_"]';
              return sel;
            }
            return '';
          }

          if (el.id) {
            const gen = generalizedIdSelector(tag, el.id);
            if (gen && isUnique(gen)) return gen;
            return '#' + el.id;
          }

          const ignoreClasses = new Set([
            'active', 'on', 'cur', 'current', 'hover', 'clearfix', 'fl', 'fr'
          ]);
          const classList = Array.from(el.classList || []).filter(Boolean).filter(c => !ignoreClasses.has(c));
          if (classList.length) {
            const c = classList[0];
            const sel = tag + '.' + CSS.escape(c);
            if (isUnique(sel)) return sel;
          }

          const path = [];
          let node = el;
          while (node && node.nodeType === Node.ELEMENT_NODE) {
            let selector = node.nodeName.toLowerCase();

            if (node.id) {
              const gen = generalizedIdSelector(selector, node.id);
              if (gen && isUnique(gen)) {
                path.unshift(gen);
                break;
              }
              selector += '#' + node.id;
              path.unshift(selector);
              break;
            }

            const cls = Array.from(node.classList || []).filter(Boolean).filter(c => !ignoreClasses.has(c));
            if (cls.length) {
              const maybe = selector + '.' + CSS.escape(cls[0]);
              if (isUnique(maybe)) {
                path.unshift(maybe);
                break;
              }
            }

            let sib = node, nth = 1;
            while (sib = sib.previousElementSibling) {
              if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
            path.unshift(selector);
            node = node.parentNode;
            if (node && node.tagName && node.tagName.toLowerCase() === 'body') break;
          }

          const full = path.join(' > ');
          if (!full) return tag;

          try {
            const parts = full.split(' > ').map(x => x.trim()).filter(Boolean);
            for (let i = 0; i < parts.length; i++) {
              const candidate = parts.slice(i).join(' > ');
              if (isUnique(candidate)) return candidate;
            }
          } catch (e) {}

          return full;
        }
      })();
    <\/script>
    <style>
      .scraper-inspector-active iframe,
      .scraper-inspector-active object,
      .scraper-inspector-active embed { pointer-events: none; }
    </style>
  `;
  
  return processed + script;
};

const toggleInspector = () => {
  // Logic now handled by watch(isInspectorActive) usually, or we can just send the message
  // But since we use v-model isInspectorActive, we should watch it.
};

watch(isInspectorActive, (active) => {
   if (!rawHtml.value) {
     if(active) message.warning("请先加载页面");
     if (active) isInspectorActive.value = false;
     return;
   }
   if (previewFrame.value && previewFrame.value.contentWindow) {
    previewFrame.value.contentWindow.postMessage({
      type: 'toggle-inspector',
      active: active
    }, '*');
  }
});

// Handle messages from iframe
const handleMessage = (event) => {
  if (event.data.type === 'element-selected') {
    if (currentFieldIndex.value !== -1 && fields[currentFieldIndex.value]) {
      fields[currentFieldIndex.value].selector = optimizeSelector(String(event.data.selector || ''));
      message.success(`已选择: ${event.data.tagName}`);
      // Refresh preview automatically
      scheduleRefreshPreview();

      if (autoAdvanceOnPick.value) {
        if (currentFieldIndex.value < fields.length - 1) {
          currentFieldIndex.value += 1;
        }
      }
      if (autoExitOnPick.value) {
        isInspectorActive.value = false;
      }
    }
  }
};

const handleKeydown = (e) => {
  const key = (e.key || '').toLowerCase();
  const isMac = navigator.platform && navigator.platform.toLowerCase().includes('mac');
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (key === 'escape') {
    isInspectorActive.value = false;
    if (codeModalVisible.value) codeModalVisible.value = false;
    if (settingsVisible.value) settingsVisible.value = false;
  }

  if (!mod) return;

  if (key === 'enter' && !e.isComposing) {
    // Only fetch if focused on URL? Actually let's restrict this
    // e.preventDefault();
    // fetchPage();
  } else if (key === 'l') {
    e.preventDefault();
    urlInputRef.value?.focus?.();
  } else if (key === 'i') {
    e.preventDefault();
    isInspectorActive.value = !isInspectorActive.value;
  }
};

onMounted(() => {
  window.addEventListener('message', handleMessage);
  window.addEventListener('keydown', handleKeydown);
  loadUrlHistory();
  loadTemplates();

  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      applyConfigSnapshot(parsed);
    }
  } catch (_) {
    // ignore
  }

  try {
    const raw = localStorage.getItem(PICK_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.autoExitOnPick === 'boolean') autoExitOnPick.value = parsed.autoExitOnPick;
      if (typeof parsed.autoAdvanceOnPick === 'boolean') autoAdvanceOnPick.value = parsed.autoAdvanceOnPick;
    }
  } catch (e) {
    // ignore
  }
});

watch([autoExitOnPick, autoAdvanceOnPick], () => {
  try {
    localStorage.setItem(PICK_SETTINGS_KEY, JSON.stringify({
      autoExitOnPick: autoExitOnPick.value,
      autoAdvanceOnPick: autoAdvanceOnPick.value
    }));
  } catch (e) {
    // ignore
  }
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('keydown', handleKeydown);
  stopCrawl();
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value);
    refreshTimer.value = null;
  }
  if (autosaveTimer.value) {
    clearTimeout(autosaveTimer.value);
    autosaveTimer.value = null;
  }
});

// --- Field Management ---
const addField = () => {
  fields.push({ 
    name: `field_${fields.length + 1}`, 
    selector: '', 
    attr: 'text', 
    customAttr: '',
    transformType: 'none',
    transformPattern: '',
    transformReplacement: ''
  });
  currentFieldIndex.value = fields.length - 1;
};

const duplicateField = (index) => {
  const field = fields[index];
  fields.splice(index + 1, 0, JSON.parse(JSON.stringify(field)));
};

const removeField = (index) => {
  fields.splice(index, 1);
  if (currentFieldIndex.value >= fields.length) {
    currentFieldIndex.value = Math.max(0, fields.length - 1);
  }
};

const copyFieldSelector = async (index) => {
  const text = (fields[index] && fields[index].selector) ? String(fields[index].selector) : '';
  if (!text) {
    message.info('暂无可复制的选择器');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    message.success('选择器已复制');
  } catch (e) {
    message.error('复制失败');
  }
};

const clearFieldSelector = (index) => {
  if (fields[index]) fields[index].selector = '';
};

// --- Preview Logic ---
const previewResult = ref([]);

const cachedDocHtml = ref('');
const cachedDoc = ref(null);
const getParsedDoc = () => {
  const html = rawHtml.value || '';
  if (!html) return null;
  if (cachedDoc.value && cachedDocHtml.value === html) return cachedDoc.value;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  cachedDoc.value = doc;
  cachedDocHtml.value = html;
  return doc;
};

const isSelectorUnique = (doc, selector) => {
  try {
    return doc.querySelectorAll(selector).length === 1;
  } catch (_) {
    return false;
  }
};

const optimizeSelector = (selector) => {
  const s = (selector || '').trim();
  if (!s) return s;
  const doc = getParsedDoc();
  if (!doc) return s;

  const generalizeDynamicIds = (sel) => {
    return sel
      .replace(/([a-z0-9_-]+)?#([a-zA-Z_-]+)_([0-9]{5,})/g, (m, tag, prefix) => {
        const t = tag ? tag : '';
        return `${t}[id^="${prefix}_"]`;
      });
  };

  if (s.includes('#')) {
    const gen = generalizeDynamicIds(s);
    if (gen !== s && isSelectorUnique(doc, gen)) return gen;
    return s;
  }

  let best = s;
  const withoutNthAll = best.replace(/:nth-of-type\(\d+\)/g, '');
  if (withoutNthAll && isSelectorUnique(doc, withoutNthAll)) best = withoutNthAll;

  const parts = best.split(' > ').map(x => x.trim()).filter(Boolean);
  for (let cut = 0; cut < parts.length - 1; cut++) {
    const candidate = parts.slice(cut).join(' > ');
    if (candidate && isSelectorUnique(doc, candidate)) best = candidate;
  }

  return best;
};

const tableColumns = computed(() => {
  return fields
    .filter(f => f && f.name)
    .map(f => ({ title: f.name, dataIndex: f.name, key: f.name }));
});

const hasPreviewData = computed(() => {
  if (listMode.value) {
    return Array.isArray(previewResult.value) && previewResult.value.length > 0;
  }
  return previewResult.value && typeof previewResult.value === 'object' && Object.keys(previewResult.value).length > 0;
});

const previewCountText = computed(() => {
  if (!processedHtml.value) return 'Ready';
  if (listMode.value) {
    const n = Array.isArray(previewResult.value) ? previewResult.value.length : 0;
    return `${n} 条结果`;
  }
  return hasPreviewData.value ? '1 条结果' : '0 条结果';
});

const refreshTimer = ref(null);
const scheduleRefreshPreview = () => {
  if (refreshTimer.value) clearTimeout(refreshTimer.value);
  refreshTimer.value = setTimeout(() => {
    refreshPreview();
  }, 250);
};

const refreshPreview = () => {
  if (!rawHtml.value) return;
  
  const doc = getParsedDoc();
  if (!doc) return;
  
  if (listMode.value && listSelector.value) {
    // List Mode
    const items = doc.querySelectorAll(listSelector.value);
    const results = [];
    items.forEach(item => {
      const row = {};
      fields.forEach(field => {
        if (field.name && field.selector) {
          const el = item.querySelector(field.selector);
          row[field.name] = extractValue(el, field, targetUrl.value);
        }
      });
      results.push(row);
    });
    previewResult.value = results;
  } else {
    // Single Mode
    const row = {};
    fields.forEach(field => {
      if (field.name && field.selector) {
        const el = doc.querySelector(field.selector);
        row[field.name] = extractValue(el, field, targetUrl.value);
      }
    });
    previewResult.value = row;
  }
};

const extractValue = (el, field, baseUrl) => {
  if (!el) return null;
  let val = '';
  switch (field.attr) {
    case 'text': val = el.textContent.trim(); break;
    case 'html': val = el.innerHTML; break;
    case 'href': val = el.getAttribute('href'); break;
    case 'src': val = el.getAttribute('src'); break;
    case 'custom': val = el.getAttribute(field.customAttr); break;
    default: val = el.textContent.trim();
  }

  if ((field.attr === 'href' || field.attr === 'src') && typeof val === 'string') {
    val = safeResolveUrl(baseUrl, val);
  }

  // Transformations
  if (val && field.transformType === 'regex' && field.transformPattern) {
    try {
      const re = new RegExp(field.transformPattern);
      const match = val.match(re);
      if (match) val = match[1] || match[0];
    } catch (e) { console.warn('Regex Error', e); }
  } else if (val && field.transformType === 'replace' && field.transformPattern) {
    try {
      val = val.replace(new RegExp(field.transformPattern, 'g'), field.transformReplacement || '');
    } catch (e) { console.warn('Replace Error', e); }
  } else if (val && field.transformType === 'trim') {
      val = val.trim();
  }

  return val;
};

const previewDataJson = computed(() => {
  return JSON.stringify(previewResult.value, null, 2);
});

const fieldSampleText = (fieldName) => {
  if (!fieldName) return '—';
  if (!hasPreviewData.value) return '—';
  const row = listMode.value ? (Array.isArray(previewResult.value) ? previewResult.value[0] : null) : previewResult.value;
  const val = row ? row[fieldName] : null;
  if (val === null || val === undefined || val === '') return '—';
  const str = String(val);
  return str.length > 80 ? str.slice(0, 80) + '…' : str;
};

const copyPreviewData = async () => {
  if (!hasPreviewData.value) return;
  try {
    await navigator.clipboard.writeText(previewDataJson.value);
    message.success('已复制预览数据');
  } catch (e) {
    message.error('复制失败');
  }
};

const detectListSelector = () => {
  if (!rawHtml.value) {
    message.warning('请先加载页面');
    return;
  }

  try {
    const doc = getParsedDoc();
    if (!doc) {
      message.error('页面解析失败');
      return;
    }
    const body = doc.body;
    if (!body) {
      message.error('页面解析失败');
      return;
    }

    let best = null;

    const parents = body.querySelectorAll('*');
    parents.forEach(parent => {
      const children = Array.from(parent.children || []);
      if (children.length < 6) return;

      const counter = new Map();
      children.forEach(ch => {
        const tag = ch.tagName ? ch.tagName.toLowerCase() : '';
        if (!tag) return;

        const cls = (ch.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
        const key = cls.length ? '.' + cls[0] : tag;
        counter.set(key, (counter.get(key) || 0) + 1);
      });

      for (const [key, count] of counter.entries()) {
        if (count < 3) continue;
        const score = count;
        if (!best || score > best.score) {
          best = { selector: key, score };
        }
      }
    });

    if (!best) {
      message.info('未检测到明显的列表结构，请手动输入');
      return;
    }

    listSelector.value = best.selector;
    message.success(`已智能填入: ${best.selector}`);
    scheduleRefreshPreview();
  } catch (e) {
    message.error('智能检测失败，请手动输入');
  }
};

watch([fields, listMode, listSelector], () => {
  scheduleRefreshPreview();
}, { deep: true });

const highlightSelectorInPreview = (selector) => {
  const sel = (selector || '').trim();
  if (!sel) return;
  if (!processedHtml.value) return;
  if (!previewFrame.value || !previewFrame.value.contentWindow) return;
  previewFrame.value.contentWindow.postMessage({
    type: 'highlight-selector',
    selector: sel
  }, '*');
};

const highlightFieldSelector = (index) => {
  if (!fields[index]) return;
  highlightSelectorInPreview(fields[index].selector);
};


// --- Code Generation ---

const sanitizeIdentifier = (raw) => {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/\s+/g, '_');
  s = s.replace(/[^a-zA-Z0-9_$]/g, '_');
  s = s.replace(/_+/g, '_');
  if (!/^[a-zA-Z_$]/.test(s)) s = '_' + s;
  return s;
};

const isValidJsIdentifier = (name) => {
  const s = String(name || '');
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);
};

const makeUniqueName = (base, used) => {
  let n = base;
  let i = 2;
  while (used.has(n)) {
    n = `${base}_${i}`;
    i += 1;
  }
  used.add(n);
  return n;
};

const buildFieldCodeMeta = () => {
  const used = new Set();
  return fields
    .filter(f => f && f.name && f.selector)
    .map((f, idx) => {
      const key = String(f.name);
      const base = sanitizeIdentifier(key) || `field_${idx + 1}`;
      const varName = makeUniqueName(`val_${base}`, used);
      return { f, key, varName };
    });
};

const jsStringLiteral = (s) => JSON.stringify(String(s ?? ''));

const pyStringLiteral = (s) => {
  const str = String(s ?? '');
  return `'${str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  }'`;
};

const generatedCode = computed(() => {
  if (codeLanguage.value === 'node') {
    return generateNodeCode();
  } else {
    return generatePythonCode();
  }
});

const showCodeModal = () => {
  codeModalVisible.value = true;
};

const generateNodeCode = () => {
  const metas = buildFieldCodeMeta();
  const processField = (f, varName) => {
    let code = '';
    // Extraction
    let extract = '';
    switch(f.attr) {
      case 'text': extract = '.text()'; break;
      case 'html': extract = '.html()'; break;
      case 'href': extract = '.attr("href")'; break;
      case 'src': extract = '.attr("src")'; break;
      case 'custom': extract = `.attr("${f.customAttr}")`; break;
      default: extract = '.text()';
    }
    code += `    let ${varName} = el.find(${jsStringLiteral(f.selector)})${extract};\n`;
    
    // Default trim for text if no transform specified or explicit trim
    if (f.attr === 'text' && f.transformType === 'none') {
        code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
    }

    // Transformations
    if (f.transformType === 'trim') {
       code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
    } else if (f.transformType === 'regex' && f.transformPattern) {
       code += `    const ${varName}_match = ${varName} ? ${varName}.match(new RegExp(${jsStringLiteral(f.transformPattern)})) : null;\n`;
       code += `    ${varName} = ${varName}_match ? (${varName}_match[1] || ${varName}_match[0]) : "";\n`;
    } else if (f.transformType === 'replace' && f.transformPattern) {
       code += `    if (${varName}) ${varName} = ${varName}.replace(new RegExp(${jsStringLiteral(f.transformPattern)}, 'g'), ${jsStringLiteral(f.transformReplacement || '')});\n`;
    }
    
    return code;
  };

  const fieldsProcessing = metas
    .map(({ f, varName }) => processField(f, varName))
    .join('\n');

  const fieldsAssignment = metas
    .map(({ key, varName }) => `      ${isValidJsIdentifier(key) ? key : jsStringLiteral(key)}: ${varName}`)
    .join(',\n');

  if (listMode.value) {
    return `const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
  const url = ${jsStringLiteral(targetUrl.value)};
  const { data } = await axios.get(url, {
     headers: ${JSON.stringify(requestHeaders.value.reduce((acc, h) => { if(h.key) acc[h.key] = h.value; return acc; }, {}), null, 4).replace(/\n/g, '\n     ')}
  });
  const $ = cheerio.load(data);
  const results = [];

  $(${jsStringLiteral(listSelector.value)}).each((i, element) => {
    const el = $(element);
${fieldsProcessing}
    results.push({
${fieldsAssignment}
    });
  });

  console.log(JSON.stringify(results, null, 2));
}

scrape();`;
  } else {
    // Single mode structure
    const singleProcessing = metas
        .map(({ f, varName }) => {
            // slightly different for single mode as root is $
            let code = `    // ${f.name}\n`;
            let selector = `$(${jsStringLiteral(f.selector)})`;
            let extract = '';
            switch(f.attr) {
              case 'text': extract = '.text()'; break;
              case 'html': extract = '.html()'; break;
              case 'href': extract = '.attr("href")'; break;
              case 'src': extract = '.attr("src")'; break;
              case 'custom': extract = `.attr("${f.customAttr}")`; break;
              default: extract = '.text()';
            }
            code += `    let ${varName} = ${selector}${extract};\n`;
            if (f.attr === 'text' && f.transformType === 'none') {
              code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
            }
            if (f.transformType === 'trim') {
              code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
            } else if (f.transformType === 'regex' && f.transformPattern) {
              code += `    const ${varName}_match = ${varName} ? ${varName}.match(new RegExp(${jsStringLiteral(f.transformPattern)})) : null;\n`;
              code += `    ${varName} = ${varName}_match ? (${varName}_match[1] || ${varName}_match[0]) : "";\n`;
            } else if (f.transformType === 'replace' && f.transformPattern) {
              code += `    if (${varName}) ${varName} = ${varName}.replace(new RegExp(${jsStringLiteral(f.transformPattern)}, 'g'), ${jsStringLiteral(f.transformReplacement || '')});\n`;
            }
            return code;
        }).join('\n');

    return `const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
  const url = ${jsStringLiteral(targetUrl.value)};
  const { data } = await axios.get(url, {
     headers: ${JSON.stringify(requestHeaders.value.reduce((acc, h) => { if(h.key) acc[h.key] = h.value; return acc; }, {}), null, 4).replace(/\n/g, '\n     ')}
  });
  const $ = cheerio.load(data);

${singleProcessing}
  const result = {
${fieldsAssignment}
  };

  console.log(JSON.stringify(result, null, 2));
}

scrape();`;
  }
};

const generatePythonCode = () => {
    const metas = buildFieldCodeMeta();
    const processField = (f, varName, isList) => {
        let code = '';
        let elVar = isList ? 'el' : 'soup';
        let selectMethod = isList ? 'select_one' : 'select_one';
        
        code += `        element = ${elVar}.${selectMethod}(${pyStringLiteral(f.selector)})\n`;
        
        let extract = '';
        switch(f.attr) {
            case 'text': extract = '.get_text()'; break; // trim handled later
            case 'html': extract = '.decode_contents()'; break;
            case 'href': extract = '.get("href")'; break;
            case 'src': extract = '.get("src")'; break;
            case 'custom': extract = `.get("${f.customAttr}")`; break;
            default: extract = '.get_text()';
        }
        
        code += `        ${varName} = element${extract} if element else None\n`;
        
        // Transforms
        if (f.attr === 'text' && f.transformType === 'none') {
             code += `        if ${varName}: ${varName} = ${varName}.strip()\n`;
        }
        if (f.transformType === 'trim') {
             code += `        if ${varName}: ${varName} = ${varName}.strip()\n`;
        } else if (f.transformType === 'regex' && f.transformPattern) {
             code += `        if ${varName}:\n`;
             code += `            match = re.search(${pyStringLiteral(f.transformPattern)}, ${varName})\n`;
             code += `            ${varName} = match.group(1) if match and match.lastindex and match.lastindex >= 1 else (match.group(0) if match else "")\n`;
        } else if (f.transformType === 'replace' && f.transformPattern) {
             code += `        if ${varName}: ${varName} = re.sub(${pyStringLiteral(f.transformPattern)}, ${pyStringLiteral(f.transformReplacement || '')}, ${varName})\n`;
        }
        
        return code;
    };

  const fieldsAssignment = metas
    .map(({ key, varName }) => `            ${pyStringLiteral(key)}: ${varName}`)
    .join(',\n');

  if (listMode.value) {
    const fieldProcessors = metas
        .map(({ f, varName }) => processField(f, varName, true))
        .join('\n');

    return `import requests
from bs4 import BeautifulSoup
import json
import re

def scrape():
    url = ${pyStringLiteral(targetUrl.value)}
    headers = ${JSON.stringify(requestHeaders.value.reduce((acc, h) => { if(h.key) acc[h.key] = h.value; return acc; }, {}), null, 4).replace(/\n/g, '\n    ').replace(/true/g, 'True').replace(/false/g, 'False')}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    results = []
    for el in soup.select(${pyStringLiteral(listSelector.value)}):
${fieldProcessors}
        results.append({
${fieldsAssignment}
        })

    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    scrape()`;
  } else {
    const fieldProcessors = metas
        .map(({ f, varName }) => processField(f, varName, false))
        .join('\n')
        .replace(/^        /gm, '    '); // Adjust indent for non-loop

    return `import requests
from bs4 import BeautifulSoup
import json
import re

def scrape():
    url = ${pyStringLiteral(targetUrl.value)}
    headers = ${JSON.stringify(requestHeaders.value.reduce((acc, h) => { if(h.key) acc[h.key] = h.value; return acc; }, {}), null, 4).replace(/\n/g, '\n    ').replace(/true/g, 'True').replace(/false/g, 'False')}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
${fieldProcessors}
    data = {
${fieldsAssignment}
    }

    print(json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    scrape()`;
  }
};

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value);
    message.success('复制成功');
  } catch (e) {
    message.error('复制失败');
  }
};

const downloadCode = () => {
  const ext = codeLanguage.value === 'node' ? 'js' : 'py';
  const blob = new Blob([generatedCode.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scraper.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};

</script>

<style scoped>
.scraper-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  color: var(--text-primary);
}

/* --- Top Bar --- */
.control-header {
   display: flex;
   flex-direction: column;
   gap: 12px;
}

.url-bar-card {
  padding: 8px;
  background: white;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  display: flex;
  align-items: center;
}

.url-input-wrapper {
   width: 100%;
}

.custom-input-group {
   display: flex;
   align-items: center;
   width: 100%;
   background: var(--surface-hover);
   border-radius: var(--border-radius-sm);
   padding: 4px;
   border: 1px solid transparent;
   transition: all 0.2s;
}

.custom-input-group:focus-within {
   border-color: var(--primary-color);
   background: white;
   box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.method-select {
   width: 85px;
}

:deep(.method-select .ant-select-selector) {
   background: transparent !important;
   font-weight: 600;
   color: var(--primary-color);
}

.divider-vertical {
   width: 1px;
   height: 20px;
   background: #e2e8f0;
   margin: 0 4px;
}

.url-input {
   flex: 1;
}

:deep(.url-input .ant-input) {
   background: transparent;
   font-size: 14px;
}

.url-actions {
   display: flex;
   align-items: center;
   padding-right: 8px;
}

.fetch-btn {
   border-radius: 6px !important;
   height: 32px;
   margin-left: 4px;
   padding: 0 16px;
   font-weight: 500;
   box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.actions-bar {
   display: flex;
   justify-content: space-between;
   align-items: center;
   padding: 0 4px;
}

.right-actions {
   display: flex;
   gap: 8px;
}

.action-btn {
   border-radius: var(--border-radius-sm);
   border: none;
   background: rgba(255, 255, 255, 0.6);
   box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.action-btn:hover {
   background: white;
   color: var(--primary-color);
}

/* --- Main Content --- */
.main-content {
   flex: 1;
   display: flex;
   gap: 16px;
   overflow: hidden;
}

.pane {
   background: white;
   border-radius: var(--border-radius);
   box-shadow: var(--box-shadow);
   display: flex;
   flex-direction: column;
   overflow: hidden;
}

.pane-header {
   padding: 12px 16px;
   border-bottom: 1px solid #f1f5f9;
   display: flex;
   justify-content: space-between;
   align-items: center;
   background: #fff;
}

.pane-title {
   font-weight: 600;
   color: var(--text-primary);
   display: flex;
   align-items: center;
   gap: 8px;
}

/* Browser Pane */
.browser-pane {
   flex: 3;
   background: #f8fafc; /* Darker bg for browser contrast */
   position: relative;
}

.browser-viewport-wrapper {
   flex: 1;
   position: relative;
   overflow: auto;
   display: flex;
   justify-content: center;
   padding: 20px;
}

.browser-viewport {
   width: 100%;
   height: 100%;
   background: white;
   border-radius: 8px;
   box-shadow: 0 10px 30px rgba(0,0,0,0.1);
   display: flex;
   flex-direction: column;
   overflow: hidden;
   border: 1px solid #e2e8f0;
   transition: all 0.4s ease;
}

.browser-viewport.mobile-view {
   width: 375px;
   height: 667px;
   border-radius: 24px;
   border: 8px solid #2d3748;
}

.browser-address-bar {
   height: 36px;
   background: #f1f5f9;
   border-bottom: 1px solid #e2e8f0;
   display: flex;
   align-items: center;
   padding: 0 12px;
   gap: 12px;
}

.traffic-lights {
   display: flex;
   gap: 6px;
}

.traffic-lights span {
   width: 10px;
   height: 10px;
   border-radius: 50%;
   background: #cbd5e1;
}

.traffic-lights span:nth-child(1) { background: #ff5f56; }
.traffic-lights span:nth-child(2) { background: #ffbd2e; }
.traffic-lights span:nth-child(3) { background: #27c93f; }

.fake-url {
   flex: 1;
   background: white;
   height: 24px;
   border-radius: 4px;
   display: flex;
   align-items: center;
   padding: 0 8px;
   font-size: 11px;
   color: #64748b;
   white-space: nowrap;
   overflow: hidden;
   text-overflow: ellipsis;
   box-shadow: 0 1px 1px rgba(0,0,0,0.05) inset;
}

.iframe-container {
   flex: 1;
   position: relative;
   background: white;
}

.preview-iframe {
   width: 100%;
   height: 100%;
   border: none;
}

.empty-state {
   position: absolute;
   top: 0; left: 0; right: 0; bottom: 0;
   display: flex;
   flex-direction: column;
   align-items: center;
   justify-content: center;
   color: #94a3b8;
}

.empty-icon-bg {
   width: 80px;
   height: 80px;
   background: #f1f5f9;
   border-radius: 50%;
   display: flex;
   align-items: center;
   justify-content: center;
   font-size: 32px;
   color: #cbd5e1;
   margin-bottom: 16px;
}

.empty-state h3 {
   font-size: 16px;
   color: #475569;
   margin-bottom: 4px;
   font-weight: 600;
}

.inspector-badge {
   color: var(--primary-color);
   font-size: 12px;
   font-weight: 600;
   display: flex;
   align-items: center;
   gap: 6px;
   background: rgba(59, 130, 246, 0.1);
   padding: 2px 8px;
   border-radius: 12px;
}

.pulse-dot {
   width: 8px;
   height: 8px;
   background: currentColor;
   border-radius: 50%;
   animation: pulse 1.5s infinite;
}

@keyframes pulse {
   0% { opacity: 1; transform: scale(1); }
   50% { opacity: 0.4; transform: scale(1.2); }
   100% { opacity: 1; transform: scale(1); }
}

.loading-overlay {
   position: absolute;
   top: 0; left: 0; right: 0; bottom: 0;
   background: rgba(255,255,255,0.8);
   display: flex;
   align-items: center;
   justify-content: center;
   z-index: 10;
   backdrop-filter: blur(2px);
}

/* Config Pane */
.config-pane {
   flex: 2;
   min-width: 320px;
   max-width: 450px;
}

.custom-tabs {
   height: 100%;
   display: flex;
   flex-direction: column;
}

:deep(.ant-tabs-nav) {
   margin: 0 !important;
   padding: 0 16px;
   border-bottom: 1px solid #f1f5f9;
}

.tab-label {
   font-size: 13px;
   padding: 12px 0;
}

:deep(.ant-tabs-content) {
   flex: 1;
   min-height: 0;
   display: flex;
}

:deep(.ant-tabs-content-holder) {
   flex: 1;
   min-height: 0;
   display: flex;
}

:deep(.ant-tabs-tabpane) {
   flex: 1;
   min-height: 0;
   display: flex;
   flex-direction: column;
}

.config-content {
   flex: 1;
   min-height: 0;
   overflow-y: auto;
   padding: 16px;
}

/* Fields List */
.fields-list {
   display: flex;
   flex-direction: column;
   gap: 12px;
}

.field-card {
   background: #fff;
   border: 1px solid #e2e8f0;
   border-radius: 8px;
   transition: all 0.2s;
   overflow: hidden;
}

.field-card:hover {
   border-color: #cbd5e1;
   box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.field-card.active {
   border-color: var(--primary-color);
   box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.field-card-header {
   padding: 8px 12px;
   background: #f8fafc;
   display: flex;
   justify-content: space-between;
   align-items: center;
   cursor: pointer;
   border-bottom: 1px solid transparent;
}

.field-card.active .field-card-header {
   border-bottom-color: #f1f5f9;
   background: #eff6ff;
}

.field-name {
   display: flex;
   align-items: center;
   gap: 8px;
   flex: 1;
}

.field-index {
   font-size: 11px;
   color: #94a3b8;
   font-weight: 600;
   width: 24px;
}

.field-name-input {
   font-weight: 500;
   color: var(--text-primary);
}

.field-actions {
   opacity: 0;
   transition: opacity 0.2s;
}

.field-card:hover .field-actions,
.field-card.active .field-actions {
   opacity: 1;
}

.field-card-body {
   padding: 12px;
   display: flex;
   flex-direction: column;
   gap: 12px;
   background: white;
}

.form-row {
   display: flex;
   gap: 8px;
   align-items: center;
}

.form-item label {
   display: block;
   font-size: 11px;
   color: #64748b;
   margin-bottom: 4px;
}

.selector-input-group :deep(.ant-input) {
   font-family: monospace;
   color: #0f172a;
}

.aim-icon {
   cursor: pointer;
   color: #94a3b8;
   transition: color 0.2s;
}

.aim-icon:hover, .aim-icon.active {
   color: var(--primary-color);
}

.selector-suffix {
   display: inline-flex;
   align-items: center;
   gap: 6px;
}

.suffix-icon {
   cursor: pointer;
   color: #94a3b8;
   transition: color 0.2s;
}

.suffix-icon:hover {
   color: var(--primary-color);
}

.field-sample {
   display: flex;
   gap: 8px;
   align-items: center;
   padding: 6px 8px;
   border-radius: 6px;
   background: #f8fafc;
   border: 1px solid #e2e8f0;
}

.sample-label {
   font-size: 11px;
   color: #64748b;
   flex: 0 0 auto;
}

.sample-value {
   font-size: 12px;
   color: #0f172a;
   flex: 1;
   white-space: nowrap;
   overflow: hidden;
   text-overflow: ellipsis;
}

.data-clean-section {
   background: #f8fafc;
   padding: 8px;
   border-radius: 6px;
   border: 1px dashed #e2e8f0;
}

.section-title {
   font-size: 10px;
   color: #94a3b8;
   margin-bottom: 6px;
   text-transform: uppercase;
   letter-spacing: 0.5px;
}

.add-field-btn {
   border-style: dashed;
   height: 40px;
}

/* Data Preview Tab Styles */
.data-tab-content {
    display: flex;
    flex-direction: column;
    padding: 0; /* Override */
}

.data-toolbar {
    padding: 10px 16px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fafc;
}

.toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.mode-label {
    font-size: 12px;
    color: #64748b;
}

.list-selector-box {
    padding: 12px 16px;
    background: white;
    border-bottom: 1px solid #f1f5f9;
}

.box-label {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 4px;
}

.preview-display {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f8fafc;
}

.display-controls {
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
}

.display-area {
    flex: 1;
    margin: 0 16px 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    position: relative;
}

.json-view {
    height: 100%;
    overflow: auto;
    padding: 16px;
}

.json-view pre {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #334155;
    margin: 0;
}

.table-view {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.no-data {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: #cbd5e1;
    font-size: 13px;
}

/* Scrollbar Customization */
.scrollbar-custom::-webkit-scrollbar {
    width: 6px;
}
.scrollbar-custom::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 3px;
}
.custom-scroll {
    overflow: auto;
}

/* Drawer Styles */
.section-divider {
    font-size: 12px;
    color: #94a3b8;
    margin: 16px 0 8px;
    font-weight: 600;
}

.headers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.pick-settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #f1f5f9;
    border-radius: 8px;
    background: #fafafa;
}

.pick-setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.pick-setting-label {
    font-size: 12px;
    color: #475569;
}

.header-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.colon {
    color: #94a3b8;
    font-weight: bold;
}

/* Code Modal */
.code-modal-body {
    height: 500px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.code-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.code-actions {
    display: flex;
    gap: 8px;
}

.code-editor-container {
    flex: 1;
    background: #1e293b;
    border-radius: 8px;
    padding: 16px;
    overflow: auto;
    color: #e2e8f0;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
}

.code-editor-container pre {
    margin: 0;
}

.template-modal-body {
  padding-top: 4px;
}

.template-load-actions {
  display: flex;
  justify-content: flex-end;
}

.help-modal-body {
  max-height: 70vh;
  overflow: auto;
  padding-right: 8px;
}

.help-modal-body h3 {
  margin: 12px 0 8px;
  font-size: 14px;
  color: #0f172a;
  font-weight: 700;
}

.help-modal-body ul,
.help-modal-body ol {
  margin: 0 0 10px;
  padding-left: 18px;
}

.help-modal-body li {
  line-height: 1.7;
  color: #334155;
}

.task-tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.task-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
}

.task-section-title {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
  font-weight: 600;
}

.task-actions-row {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-stats-row {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.task-grid-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-subgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.task-subgrid-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-label {
  font-size: 11px;
  color: #64748b;
}

.task-empty {
  padding: 14px;
  border-radius: 8px;
  border: 1px dashed #e2e8f0;
  color: #94a3b8;
  background: #f8fafc;
  text-align: center;
}

.task-popover {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-popover-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.task-panel-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-panel-title {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.task-log-box {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #0b1220;
  color: #e2e8f0;
  padding: 10px;
  max-height: 260px;
  overflow: auto;
}

.task-log-line {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* List Transition */
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
