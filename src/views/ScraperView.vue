<template>
  <div class="scraper-container">
    <!-- Top Bar: Control Panel -->
    <div class="control-panel glass-effect">
      <div class="nav-left">
        <a-input-group compact class="nav-input-group">
          <a-select
            v-model:value="requestMethod"
            class="method-select"
            :bordered="false"
          >
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
                <LinkOutlined class="text-icon" />
              </template>
            </a-input>
          </a-auto-complete>
          <a-button
            type="primary"
            class="fetch-btn"
            :loading="loading"
            :disabled="!canFetch"
            @click="fetchPage"
            title="Ctrl+Enter 快速加载"
          >
            <template #icon><GlobalOutlined /></template>
            加载
          </a-button>
        </a-input-group>
      </div>

      <div class="nav-right">
        <!-- Inspector Switch -->
        <div class="mode-switch-wrapper">
          <a-radio-group
            v-model:value="isInspectorActive"
            button-style="solid"
            size="small"
          >
            <a-radio-button :value="false">浏览</a-radio-button>
            <a-radio-button :value="true"><AimOutlined /> 选取</a-radio-button>
          </a-radio-group>
        </div>

        <div class="divider-vertical"></div>

        <!-- Quick Actions -->
        <a-tooltip title="粘贴网址 (Ctrl+V)">
          <a-button type="text" class="icon-btn" @click="pasteUrl">
            <CopyOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="清空输入 (Ctrl+Delete)">
          <a-button
            type="text"
            class="icon-btn"
            @click="clearTargetUrl"
            :disabled="!targetUrl"
          >
            <ClearOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="在浏览器打开 (Ctrl+B)">
          <a-button
            type="text"
            class="icon-btn"
            @click="openInBrowser"
            :disabled="!targetUrl"
          >
            <GlobalOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="请求设置 (Ctrl+,)">
          <a-button
            type="text"
            class="icon-btn"
            @click="settingsVisible = true"
          >
            <SettingOutlined />
          </a-button>
        </a-tooltip>

        <div class="divider-vertical"></div>

        <!-- Major Actions -->
        <a-tooltip title="生成代码 (Ctrl+K)">
          <a-button type="text" class="icon-btn" @click="showCodeModal">
            <CodeOutlined />
          </a-button>
        </a-tooltip>

        <a-dropdown :trigger="['click']">
          <a-tooltip title="规则管理 (Ctrl+S 保存)">
            <a-button type="text" class="icon-btn">
              <FolderOpenOutlined />
            </a-button>
          </a-tooltip>
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
        </a-dropdown>

        <a-tooltip title="使用说明">
          <a-button
            type="text"
            class="icon-btn"
            @click="helpModalVisible = true"
          >
            <QuestionCircleOutlined />
          </a-button>
        </a-tooltip>

        <input
          type="file"
          ref="fileInput"
          style="display: none"
          accept=".json"
          @change="importRules"
        />
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Left: Browser Preview -->
      <div class="pane browser-pane">
        <div class="pane-header">
          <div class="pane-title"><DesktopOutlined /> 页面预览</div>
          <div class="pane-controls">
            <span v-if="isInspectorActive" class="inspector-badge">
              <span class="pulse-dot"></span> 正在选取元素...
            </span>
            <a-radio-group
              v-model:value="isMobileView"
              size="small"
              button-style="solid"
            >
              <a-radio-button :value="false"
                ><DesktopOutlined
              /></a-radio-button>
              <a-radio-button :value="true"><MobileOutlined /></a-radio-button>
            </a-radio-group>
          </div>
        </div>

        <div class="browser-viewport-wrapper">
          <div
            class="browser-viewport"
            ref="browserContainer"
            :class="{
              'mobile-view': isMobileView,
              'inspector-active': isInspectorActive,
            }"
          >
            <div class="browser-address-bar" v-if="processedHtml">
              <div class="traffic-lights">
                <span></span><span></span><span></span>
              </div>
              <div class="fake-url">
                <span v-if="loading" style="color: #3b82f6;">
                  <LoadingOutlined style="margin-right: 8px" />
                  正在加载...
                </span>
                <span v-else-if="targetUrl">{{ targetUrl }}</span>
                <span v-else style="color: #9ca3af; font-style: italic">about:blank</span>
              </div>
              <ReloadOutlined
                class="browser-reload-icon"
                :class="{ 'loading-spin': loading }"
                @click="fetchPage"
                :title="loading ? '加载中...' : '刷新页面 (Ctrl+R)'"
              />
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
                <p>在上方输入目标网址并点击 <b style="color: var(--accent-color)">加载</b> 开始配置爬虫规则</p>
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
        <a-tabs
          v-model:activeKey="activeTab"
          class="custom-tabs"
          :tabBarGutter="24"
        >
          <!-- Fields Tab -->
          <a-tab-pane key="fields">
            <template #tab>
              <span class="tab-label"> 规则 </span>
            </template>

            <div class="config-content scrollbar-custom">
              <div class="fields-list">
                <transition-group name="list" tag="div">
                  <div
                    v-for="(field, index) in fields"
                    :key="index"
                    class="field-card"
                    :class="{
                      active: currentFieldIndex === index,
                      'flash-success': updatedFields.has(index),
                    }"
                    :data-index="index"
                    @click="currentFieldIndex = index"
                  >
                    <div class="field-card-header">
                      <div class="field-name">
                        <span class="field-index">#{{ index + 1 }}</span>
                        <a-input
                          v-model:value="field.name"
                          placeholder="字段名"
                          size="small"
                          class="field-name-input"
                          :bordered="false"
                        />
                        <a-tag
                          v-if="processedHtml"
                          class="field-diag-tag"
                          :color="fieldDiagnosticColor(index)"
                          style="cursor: help"
                          :title="
                            fieldDiagnosticText(index) === '✓'
                              ? '选择器有效'
                              : fieldDiagnosticText(index) === '✗'
                              ? '选择器无效或无匹配'
                              : '待验证'
                          "
                          >{{ fieldDiagnosticText(index) }}</a-tag
                        >
                      </div>
                      <div class="field-actions">
                        <a-tooltip title="上移">
                          <a-button
                            type="text"
                            size="small"
                            :disabled="index === 0"
                            @click.stop="moveField(index, -1)"
                            ><ArrowUpOutlined
                          /></a-button>
                        </a-tooltip>
                        <a-tooltip title="下移">
                          <a-button
                            type="text"
                            size="small"
                            :disabled="index === fields.length - 1"
                            @click.stop="moveField(index, 1)"
                            ><ArrowDownOutlined
                          /></a-button>
                        </a-tooltip>
                        <div class="divider-vertical-small"></div>
                        <a-tooltip title="复制">
                          <a-button
                            type="text"
                            size="small"
                            @click.stop="duplicateField(index)"
                            ><CopyOutlined
                          /></a-button>
                        </a-tooltip>
                        <a-tooltip title="删除">
                          <a-button
                            type="text"
                            danger
                            size="small"
                            @click.stop="removeField(index)"
                            ><DeleteOutlined
                          /></a-button>
                        </a-tooltip>
                      </div>
                    </div>

                    <div
                      class="field-card-body"
                      v-show="currentFieldIndex === index"
                    >
                      <div class="form-row">
                        <div class="form-item" style="flex: 1">
                          <label>CSS 选择器</label>
                          <div class="selector-input-group">
                            <a-input
                              v-model:value="field.selector"
                              placeholder="点击左侧元素自动获取"
                              size="small"
                            >
                              <template #suffix>
                                <span class="selector-suffix" @click.stop>
                                  <a-tooltip title="复制选择器">
                                    <CopyOutlined
                                      class="suffix-icon"
                                      @click.stop="copyFieldSelector(index)"
                                    />
                                  </a-tooltip>
                                  <a-tooltip title="清空选择器">
                                    <ClearOutlined
                                      class="suffix-icon"
                                      @click.stop="clearFieldSelector(index)"
                                    />
                                  </a-tooltip>
                                  <a-tooltip title="在预览中高亮">
                                    <AimOutlined
                                      class="aim-icon"
                                      :class="{ active: isInspectorActive }"
                                      @click.stop="
                                        highlightFieldSelector(index)
                                      "
                                    />
                                  </a-tooltip>
                                </span>
                              </template>
                            </a-input>
                          </div>
                        </div>
                        <div class="form-item" style="width: 100px">
                          <label>属性</label>
                          <a-select
                            v-model:value="field.attr"
                            size="small"
                            style="width: 100%"
                          >
                            <a-select-option value="text">Text</a-select-option>
                            <a-select-option value="html">HTML</a-select-option>
                            <a-select-option value="href">Href</a-select-option>
                            <a-select-option value="src">Src</a-select-option>
                            <a-select-option value="custom"
                              >Custom</a-select-option
                            >
                          </a-select>
                        </div>
                      </div>

                      <div v-if="field.attr === 'custom'" class="form-row">
                        <div class="form-item">
                          <label>自定义属性名</label>
                          <a-input
                            v-model:value="field.customAttr"
                            placeholder="例如 data-id"
                            size="small"
                          />
                        </div>
                      </div>

                      <div v-if="processedHtml" class="field-sample">
                        <span class="sample-label">示例</span>
                        <span class="sample-value">{{
                          fieldSampleText(field.name)
                        }}</span>
                      </div>

                      <div class="data-clean-section">
                        <div class="section-title">数据清洗</div>
                        <div class="form-row">
                          <div class="form-item" style="width: 100px">
                            <a-select
                              v-model:value="field.transformType"
                              size="small"
                              style="width: 100%"
                            >
                              <a-select-option value="none"
                                >无处理</a-select-option
                              >
                              <a-select-option value="trim"
                                >Trim</a-select-option
                              >
                              <a-select-option value="regex"
                                >正则提取</a-select-option
                              >
                              <a-select-option value="replace"
                                >替换</a-select-option
                              >
                            </a-select>
                          </div>
                          <div
                            class="form-item"
                            style="flex: 1"
                            v-if="
                              ['regex', 'replace'].includes(field.transformType)
                            "
                          >
                            <a-input
                              v-model:value="field.transformPattern"
                              :placeholder="
                                field.transformType === 'regex'
                                  ? '正则 (e.g. Price: (\\d+))'
                                  : '匹配正则'
                              "
                              size="small"
                            />
                          </div>
                          <div
                            class="form-item"
                            style="flex: 1"
                            v-if="field.transformType === 'replace'"
                          >
                            <a-input
                              v-model:value="field.transformReplacement"
                              placeholder="替换值 (留空删除)"
                              size="small"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </transition-group>

                <div v-if="fields.length === 0" class="empty-fields-state">
                  <div class="empty-icon"><ProfileOutlined /></div>
                  <div class="empty-text">暂无提取字段</div>
                </div>

                <a-button
                  type="dashed"
                  block
                  class="add-field-btn"
                  @click="addField"
                >
                  <PlusOutlined /> 添加新字段
                </a-button>
              </div>
            </div>
          </a-tab-pane>

          <!-- Data Preview Tab -->
          <a-tab-pane key="data">
            <template #tab>
              <span class="tab-label"> 预览 </span>
            </template>
            <div class="config-content data-tab-content">
              <div class="data-toolbar">
                <div class="toolbar-left">
                  <span class="mode-label">采集模式:</span>
                  <a-radio-group
                    v-model:value="listMode"
                    size="small"
                    button-style="solid"
                  >
                    <a-radio-button :value="false">单条</a-radio-button>
                    <a-radio-button :value="true">列表</a-radio-button>
                  </a-radio-group>
                </div>
                <div class="toolbar-right">
                  <a-tag color="blue">{{ previewCountText }}</a-tag>
                  <a-button
                    type="text"
                    size="small"
                    @click="refreshPreview"
                    :loading="loading"
                    title="刷新数据预览"
                    ><ReloadOutlined
                  /></a-button>
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
                        <a-menu-item @click="exportData('json')"
                          ><FileTextOutlined /> 导出 JSON</a-menu-item
                        >
                        <a-menu-item @click="exportData('csv')"
                          ><TableOutlined /> 导出 CSV</a-menu-item
                        >
                      </a-menu>
                    </template>
                    <a-button size="small">导出 <DownOutlined /></a-button>
                  </a-dropdown>

                  <a-button
                    size="small"
                    @click="copyPreviewData"
                    :disabled="!hasPreviewData"
                  >
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
              <span class="tab-label"> 执行 </span>
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
                  <a-button
                    size="small"
                    @click="useCurrentUrlAsStart"
                    :disabled="!targetUrl"
                  >
                    使用当前 URL
                  </a-button>
                  <a-button size="small" @click="importStartUrlsToQueue">
                    导入到队列
                  </a-button>
                  <a-button
                    size="small"
                    danger
                    @click="clearCrawlQueue"
                    :disabled="crawlQueue.length === 0"
                  >
                    清空队列
                  </a-button>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">执行参数</div>
                <div class="task-grid">
                  <div class="task-grid-item">
                    <div class="task-label">最大抓取页数</div>
                    <a-input-number
                      v-model:value="crawlMaxPages"
                      :min="1"
                      :max="10000"
                      style="width: 100%"
                    />
                  </div>
                  <div class="task-grid-item">
                    <div class="task-label">并发</div>
                    <a-input-number
                      v-model:value="crawlConcurrency"
                      :min="1"
                      :max="8"
                      style="width: 100%"
                    />
                  </div>
                  <div class="task-grid-item">
                    <div class="task-label">请求间隔(ms)</div>
                    <a-input-number
                      v-model:value="crawlDelayMs"
                      :min="0"
                      :max="60000"
                      style="width: 100%"
                    />
                  </div>
                  <div class="task-grid-item">
                    <div class="task-label">失败重试</div>
                    <a-input-number
                      v-model:value="crawlRetry"
                      :min="0"
                      :max="10"
                      style="width: 100%"
                    />
                  </div>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">链接发现 / 分页</div>
                <div class="task-subgrid">
                  <div class="task-subgrid-item">
                    <div class="task-label">发现链接选择器</div>
                    <a-input
                      v-model:value="discoverLinksSelector"
                      placeholder="例如 a.detail-link"
                    />
                  </div>
                  <div class="task-subgrid-item">
                    <div class="task-label">链接属性</div>
                    <a-select
                      v-model:value="discoverLinksAttr"
                      style="width: 100%"
                    >
                      <a-select-option value="href">href</a-select-option>
                      <a-select-option value="src">src</a-select-option>
                      <a-select-option value="custom">custom</a-select-option>
                    </a-select>
                  </div>
                  <div
                    class="task-subgrid-item"
                    v-if="discoverLinksAttr === 'custom'"
                  >
                    <div class="task-label">自定义属性名</div>
                    <a-input
                      v-model:value="discoverLinksCustomAttr"
                      placeholder="例如 data-url"
                    />
                  </div>
                </div>

                <div class="task-subgrid" style="margin-top: 12px">
                  <div class="task-subgrid-item">
                    <div class="task-label">下一页选择器</div>
                    <a-input
                      v-model:value="nextPageSelector"
                      placeholder="例如 a.next"
                    />
                  </div>
                  <div class="task-subgrid-item">
                    <div class="task-label">下一页属性</div>
                    <a-select v-model:value="nextPageAttr" style="width: 100%">
                      <a-select-option value="href">href</a-select-option>
                      <a-select-option value="custom">custom</a-select-option>
                    </a-select>
                  </div>
                  <div
                    class="task-subgrid-item"
                    v-if="nextPageAttr === 'custom'"
                  >
                    <div class="task-label">自定义属性名</div>
                    <a-input
                      v-model:value="nextPageCustomAttr"
                      placeholder="例如 data-next"
                    />
                  </div>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">运行</div>
                <div class="task-actions-row">
                  <a-button
                    type="primary"
                    @click="startCrawl"
                    :loading="crawlRunning"
                    :disabled="crawlRunning"
                  >
                    <template #icon><PlayCircleOutlined /></template>
                    开始
                  </a-button>
                  <a-button @click="togglePauseCrawl" :disabled="!crawlRunning">
                    {{ crawlPaused ? "继续" : "暂停" }}
                  </a-button>
                  <a-button danger @click="stopCrawl" :disabled="!crawlRunning">
                    <template #icon><StopOutlined /></template>
                    停止
                  </a-button>
                  <a-button
                    @click="clearCrawlResults"
                    :disabled="crawlResults.length === 0"
                  >
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
                          <a-select
                            v-model:value="crawlDedupKey"
                            style="width: 220px"
                            :options="crawlDedupKeyOptions"
                          />
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
                        <a-menu-item @click="exportCrawlData('json')"
                          ><FileTextOutlined /> 导出 JSON</a-menu-item
                        >
                        <a-menu-item @click="exportCrawlData('csv')"
                          ><TableOutlined /> 导出 CSV</a-menu-item
                        >
                        <a-menu-item @click="exportCrawlData('txt')"
                          ><FileTextOutlined /> 导出 TXT</a-menu-item
                        >
                      </a-menu>
                    </template>
                    <a-button :disabled="crawlResults.length === 0"
                      >导出 <DownOutlined
                    /></a-button>
                  </a-dropdown>
                </div>
                <div class="task-stats-row">
                  <a-tag color="blue">队列: {{ crawlQueue.length }}</a-tag>
                  <a-tag color="geekblue">已抓取: {{ crawlProcessed }}</a-tag>
                  <a-tag color="green">结果: {{ crawlResults.length }}</a-tag>
                  <a-tag v-if="crawlFailures.length" color="red"
                    >失败: {{ crawlFailures.length }}</a-tag
                  >
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">任务面板</div>
                <a-collapse :bordered="false">
                  <a-collapse-panel key="q" header="队列 / 正在抓取">
                    <div class="task-panel-grid">
                      <div class="task-panel-col">
                        <div class="task-panel-title">正在抓取</div>
                        <a-list
                          size="small"
                          bordered
                          :data-source="crawlActiveUrls"
                          :locale="{ emptyText: '无' }"
                        >
                          <template #renderItem="{ item }">
                            <a-list-item>{{ item }}</a-list-item>
                          </template>
                        </a-list>
                      </div>
                      <div class="task-panel-col">
                        <div class="task-panel-title">待抓取队列</div>
                        <a-list
                          size="small"
                          bordered
                          :data-source="crawlQueuePreview"
                          :locale="{ emptyText: '无' }"
                        >
                          <template #renderItem="{ item }">
                            <a-list-item>{{ item }}</a-list-item>
                          </template>
                        </a-list>
                      </div>
                    </div>
                  </a-collapse-panel>
                  <a-collapse-panel key="f" header="失败记录">
                    <div class="task-actions-row" style="margin-top: 0">
                      <a-button
                        size="small"
                        @click="clearCrawlFailures"
                        :disabled="crawlFailures.length === 0"
                        >清空失败</a-button
                      >
                      <a-button
                        size="small"
                        @click="exportCrawlFailures"
                        :disabled="crawlFailures.length === 0"
                        >导出失败 JSON</a-button
                      >
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
                      <a-button
                        size="small"
                        @click="clearCrawlLogs"
                        :disabled="crawlLogs.length === 0"
                        >清空日志</a-button
                      >
                    </div>
                    <div class="task-log-box">
                      <div
                        v-if="crawlLogs.length === 0"
                        class="task-empty"
                        style="margin: 0"
                      >
                        暂无日志
                      </div>
                      <div v-else>
                        <div
                          v-for="(line, idx) in crawlLogs"
                          :key="idx"
                          class="task-log-line"
                        >
                          {{ line }}
                        </div>
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

          <a-tab-pane key="api">
            <template #tab>
              <span class="tab-label"> API </span>
            </template>

            <div class="config-content">
              <div style="display: flex; flex-direction: column; gap: 12px">
                <div style="display: flex; gap: 8px; align-items: center">
                  <a-select v-model:value="apiMode.method" style="width: 120px">
                    <a-select-option value="GET">GET</a-select-option>
                    <a-select-option value="POST">POST</a-select-option>
                  </a-select>
                  <a-input
                    v-model:value="apiMode.url"
                    placeholder="接口 URL (https://...)"
                  />
                  <a-button
                    type="primary"
                    :loading="apiLoading"
                    @click="runApiRequest"
                  >
                    请求
                  </a-button>
                </div>

                <div style="display: flex; gap: 8px; align-items: center">
                  <a-input
                    v-model:value="apiMode.dataPath"
                    placeholder="数据路径 (可选，例如 data.list 或 result.items)"
                  />
                  <a-tag v-if="apiResponseStatus" color="blue">
                    {{ apiResponseStatus }} {{ apiResponseStatusText }} ({{
                      apiResponseTimeMs
                    }}ms)
                  </a-tag>
                </div>

                <div>
                  <div style="font-weight: 600; margin-bottom: 6px">
                    Headers
                  </div>
                  <div
                    v-for="(h, idx) in apiMode.headers"
                    :key="idx"
                    style="
                      display: flex;
                      gap: 8px;
                      align-items: center;
                      margin-bottom: 6px;
                    "
                  >
                    <a-input v-model:value="h.key" placeholder="Key" />
                    <a-input v-model:value="h.value" placeholder="Value" />
                    <a-button type="text" danger @click="removeApiHeader(idx)">
                      <DeleteOutlined />
                    </a-button>
                  </div>
                  <a-button type="dashed" block @click="addApiHeader">
                    <PlusOutlined /> 添加 Header
                  </a-button>
                </div>

                <div
                  v-if="apiMode.method !== 'GET'"
                  style="display: flex; flex-direction: column; gap: 6px"
                >
                  <div style="font-weight: 600">Body</div>
                  <a-textarea
                    v-model:value="apiMode.body"
                    :auto-size="{ minRows: 4, maxRows: 10 }"
                    placeholder="请求体（建议 JSON 字符串）"
                  />
                </div>

                <div>
                  <div
                    style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      margin-bottom: 6px;
                    "
                  >
                    <div style="font-weight: 600">字段映射（name/path）</div>
                    <a-button size="small" @click="addExtractField">
                      <PlusOutlined /> 添加
                    </a-button>
                  </div>
                  <div
                    v-if="apiMode.extract.length === 0"
                    style="color: #94a3b8"
                  >
                    暂无映射，默认直接输出 dataPath 对应的数据
                  </div>
                  <div
                    v-for="(m, idx) in apiMode.extract"
                    :key="idx"
                    style="
                      display: flex;
                      gap: 8px;
                      align-items: center;
                      margin-bottom: 6px;
                    "
                  >
                    <a-input
                      v-model:value="m.name"
                      placeholder="字段名"
                      style="width: 160px"
                    />
                    <a-input
                      v-model:value="m.path"
                      placeholder="路径（例如 title 或 item.title 或 a.b[0].c）"
                    />
                    <a-button
                      type="text"
                      danger
                      @click="removeExtractField(idx)"
                    >
                      <DeleteOutlined />
                    </a-button>
                  </div>
                </div>

                <div>
                  <div style="font-weight: 600; margin-bottom: 6px">
                    提取结果预览
                  </div>
                  <div
                    v-if="apiResponseError"
                    style="color: #ef4444; white-space: pre-wrap"
                  >
                    {{ apiResponseError }}
                  </div>
                  <div v-else-if="!apiHasExtracted" style="color: #94a3b8">
                    暂无数据
                  </div>
                  <pre
                    v-else
                    style="margin: 0; max-height: 420px; overflow: auto"
                    >{{ apiExtractedJson }}</pre
                  >
                </div>

                <div>
                  <div style="font-weight: 600; margin-bottom: 6px">
                    原始响应
                  </div>
                  <pre style="margin: 0; max-height: 260px; overflow: auto">{{
                    apiResponseText
                  }}</pre>
                </div>
              </div>
            </div>
          </a-tab-pane>

   
          <a-tab-pane key="novel">
            <template #tab>
              <span class="tab-label"><BookOutlined /> 小说</span>
            </template>

            <div class="config-content novel-tab-content">
              <!-- Status Overview -->
              <div class="novel-status-card">
                <div class="novel-hero">
                  <div class="novel-hero-icon">
                    <BookOutlined />
                  </div>
                  <div class="novel-hero-content">
                    <h3 class="novel-hero-title">小说爬虫</h3>
                    <p class="novel-hero-desc">目录解析 → 后端高效抓取 → 一键导出</p>
                  </div>
                </div>
                <div class="novel-status-tags">
                  <div class="status-tag status-tag-pending">
                    <div class="status-tag-icon"><ClockCircleOutlined /></div>
                    <div class="status-tag-info">
                      <span class="tag-label">待抓取</span>
                      <span class="tag-value">{{ novelCrawlQueueRemaining }}</span>
                    </div>
                  </div>
                  <div class="status-tag status-tag-success">
                    <div class="status-tag-icon"><CheckCircleOutlined /></div>
                    <div class="status-tag-info">
                      <span class="tag-label">已抓取</span>
                      <span class="tag-value">{{ novelCrawlResultsCount }}</span>
                    </div>
                  </div>
                  <div v-if="novelCrawlRunning" class="status-tag status-tag-running">
                    <div class="status-tag-icon"><LoadingOutlined spin /></div>
                    <div class="status-tag-info">
                      <span class="tag-label">状态</span>
                      <span class="tag-value">运行中</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Directory Parsing Section -->
              <div class="novel-section novel-section-step1">
                <div class="novel-section-header">
                  <div class="section-step-badge">1</div>
                  <div class="section-header-content">
                    <span class="section-title">目录解析</span>
                    <span class="section-subtitle">解析小说章节目录页</span>
                  </div>
                </div>

                <div class="novel-form">
                  <!-- URL Input -->
                  <div class="form-group">
                    <label class="form-label">
                      <LinkOutlined style="margin-right: 6px" />
                      目录页 URL
                    </label>
                    <div class="input-with-button">
                      <a-input
                        v-model:value="directoryUrl"
                        placeholder="输入小说目录页 URL (https://...)"
                        size="large"
                        class="novel-input"
                      >
                        <template #prefix>
                          <GlobalOutlined style="color: #9ca3af" />
                        </template>
                      </a-input>
                      <a-button
                        @click="directoryUrl = targetUrl"
                        :disabled="!targetUrl"
                        title="使用当前页面的 URL"
                      >
                        <CopyOutlined /> 使用当前
                      </a-button>
                    </div>
                  </div>

                  <!-- Selector & Settings -->
                  <div class="form-row">
                    <div class="form-group" style="flex: 2">
                      <label class="form-label">
                        <AimOutlined style="margin-right: 6px" />
                        章节链接选择器
                      </label>
                      <a-input
                        v-model:value="novelLinkSelector"
                        placeholder="CSS 选择器，例如：.chapter-list a"
                        class="novel-input"
                      />
                    </div>
                    <div class="form-group" style="flex: 1">
                      <label class="form-label">链接属性</label>
                      <a-select v-model:value="novelLinkAttr" class="novel-select">
                        <a-select-option value="href">href</a-select-option>
                        <a-select-option value="data-href">data-href</a-select-option>
                        <a-select-option value="text">text</a-select-option>
                      </a-select>
                    </div>
                    <div class="form-group" style="flex: 1">
                      <label class="form-label">最大数量</label>
                      <a-input-number
                        v-model:value="novelMaxItems"
                        :min="1"
                        :max="5000"
                        style="width: 100%"
                        placeholder="5000"
                      />
                    </div>
                  </div>

                  <!-- Filters -->
                  <div class="form-group">
                    <label class="form-label">
                      <FilterOutlined style="margin-right: 6px" />
                      过滤规则（可选）
                    </label>
                    <div class="filter-row">
                      <div class="filter-item">
                        <a-switch v-model:checked="novelSameDomainOnly" />
                        <span class="filter-label">仅同域名</span>
                      </div>
                      <a-input
                        v-model:value="novelIncludePattern"
                        placeholder="包含正则（留空不过滤）"
                        style="flex: 1"
                      />
                      <a-input
                        v-model:value="novelExcludePattern"
                        placeholder="排除正则（留空不过滤）"
                        style="flex: 1"
                      />
                    </div>
                  </div>

                  <!-- Parse Button -->
                  <div class="action-row">
                    <a-button
                      type="primary"
                      size="large"
                      :loading="novelParsing"
                      :disabled="!novelCanParse"
                      @click="parseNovelDirectory"
                      class="primary-action-btn"
                    >
                      <template #icon><SearchOutlined /></template>
                      解析章节目录
                    </a-button>
                    <a-tag v-if="novelChapters.length > 0" color="blue" class="result-tag">
                      已找到 {{ novelChapters.length }} 个章节
                    </a-tag>
                  </div>

                  <!-- Error Message -->
                  <a-alert
                    v-if="novelParseError"
                    type="error"
                    :message="novelParseError"
                    show-icon
                    closable
                    style="margin-top: 12px"
                  />

                  <!-- Chapters List -->
                  <div v-if="novelChapters.length > 0" class="chapters-list">
                    <div class="list-header">
                      <span class="list-title">章节列表预览</span>
                      <span class="list-info">（最多显示前 50 条）</span>
                    </div>
                    <a-list
                      size="small"
                      bordered
                      :data-source="novelChapters.slice(0, 50)"
                      class="novel-chapters-list"
                    >
                      <template #renderItem="{ item, index }">
                        <a-list-item class="chapter-item">
                          <div class="chapter-index">{{ index + 1 }}</div>
                          <div class="chapter-info">
                            <div class="chapter-title">{{ item.title || "—" }}</div>
                            <div class="chapter-url">{{ item.url }}</div>
                          </div>
                        </a-list-item>
                      </template>
                    </a-list>
                  </div>
                </div>
              </div>

              <!-- Scraping Rules Section -->
              <div class="novel-section novel-section-step2">
                <div class="novel-section-header">
                  <div class="section-step-badge">2</div>
                  <div class="section-header-content">
                    <span class="section-title">抓取规则</span>
                    <span class="section-subtitle">配置章节内容提取规则</span>
                  </div>
                </div>

                <div class="novel-form">
                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">标题选择器</label>
                      <a-input
                        v-model:value="novelTitleSelector"
                        placeholder="例如：h1, .title, #chapter-title"
                        class="novel-input"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">正文选择器</label>
                      <a-input
                        v-model:value="novelContentSelector"
                        placeholder="例如：#content, .article-content"
                        class="novel-input"
                      />
                    </div>
                  </div>

                  <!-- Options -->
                  <div class="options-grid">
                    <div class="option-item">
                      <a-switch v-model:checked="novelExportIncludeUrlLine" />
                      <div class="option-content">
                        <div class="option-label">导出附带 URL</div>
                        <div class="option-desc">在每章开头包含来源链接</div>
                      </div>
                    </div>
                    <div class="option-item">
                      <a-switch v-model:checked="novelCleanEnabled" />
                      <div class="option-content">
                        <div class="option-label">启用内容清洗</div>
                        <div class="option-desc">使用正则表达式清理广告</div>
                      </div>
                    </div>
                  </div>

                  <!-- Clean Regex -->
                  <div v-if="novelCleanEnabled" class="form-group">
                    <label class="form-label">
                      <CleanOutlined style="margin-right: 6px" />
                      清洗正则表达式
                    </label>
                    <a-textarea
                      v-model:value="novelCleanRegexText"
                      placeholder="每行一个正则表达式（匹配到的内容会被删除）&#10;例如：&#10;app2\(\);&#10;read2\(\);&#10;chaptererror\(\);"
                      :auto-size="{ minRows: 3, maxRows: 6 }"
                      class="novel-textarea"
                    />
                  </div>
                </div>
              </div>

              <!-- Execution Parameters -->
              <div class="novel-section novel-section-step3">
                <div class="novel-section-header">
                  <div class="section-step-badge">3</div>
                  <div class="section-header-content">
                    <span class="section-title">执行参数</span>
                    <span class="section-subtitle">配置抓取性能参数</span>
                  </div>
                </div>

                <div class="novel-form">
                  <div class="params-grid">
                    <div class="param-item">
                      <label class="param-label">并发数</label>
                      <a-input-number
                        v-model:value="novelCrawlConcurrency"
                        :min="1"
                        :max="8"
                        style="width: 100%"
                      />
                      <span class="param-hint">同时抓取的章节数</span>
                    </div>
                    <div class="param-item">
                      <label class="param-label">间隔时间</label>
                      <a-input-number
                        v-model:value="novelCrawlDelayMs"
                        :min="0"
                        :max="30000"
                        style="width: 100%"
                        :formatter="value => `${value} ms`"
                        :parser="value => value.replace(' ms', '')"
                      />
                      <span class="param-hint">请求间隔（毫秒）</span>
                    </div>
                    <div class="param-item">
                      <label class="param-label">重试次数</label>
                      <a-input-number
                        v-model:value="novelCrawlRetry"
                        :min="0"
                        :max="10"
                        style="width: 100%"
                      />
                      <span class="param-hint">失败后重试</span>
                    </div>
                    <div class="param-item">
                      <label class="param-label">最大章节数</label>
                      <a-input-number
                        v-model:value="novelCrawlMaxPages"
                        :min="1"
                        :max="20000"
                        style="width: 100%"
                      />
                      <span class="param-hint">抓取上限</span>
                    </div>
                  </div>

                  <div class="action-row">
                    <a-button
                      danger
                      :disabled="!novelCrawlRunning"
                      @click="cancelNovelExport"
                    >
                      <StopOutlined /> 停止任务
                    </a-button>
                    <a-button
                      :disabled="novelCrawlRunning"
                      @click="
                        novelCrawlFailures = [];
                        novelCrawlLogs = [];
                        novelCrawlLogsText = '';
                      "
                    >
                      <DeleteOutlined /> 清空日志
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- Export Section -->
              <div class="novel-section export-section">
                <div class="novel-section-header">
                  <div class="section-step-badge section-step-badge-light">4</div>
                  <div class="section-header-content">
                    <span class="section-title">导出小说</span>
                    <span class="section-subtitle">选择导出格式并开始抓取</span>
                  </div>
                </div>

                <div class="novel-form">
                  <!-- JSON Field Names -->
                  <div class="form-group">
                    <label class="form-label">
                      <CodeOutlined style="margin-right: 6px" />
                      JSON 字段映射（仅用于 JSON 导出）
                    </label>
                    <div class="json-fields-row">
                      <a-input
                        v-model:value="novelJsonKeyTitle"
                        placeholder="title"
                        addon-before="标题"
                      />
                      <a-input
                        v-model:value="novelJsonKeyContent"
                        placeholder="content"
                        addon-before="内容"
                      />
                      <a-input
                        v-model:value="novelJsonKeyUrl"
                        placeholder="url"
                        addon-before="链接"
                      />
                    </div>
                  </div>

                  <!-- Export Buttons -->
                  <div class="export-actions">
                    <a-button
                      type="primary"
                      size="large"
                      :disabled="novelChapters.length === 0 || novelCrawlRunning"
                      @click="exportNovelCrawlerTxt"
                      class="export-btn export-txt"
                    >
                      <template #icon><FileTextOutlined /></template>
                      导出为 TXT 文件
                    </a-button>
                    <a-button
                      size="large"
                      :disabled="novelChapters.length === 0 || novelCrawlRunning"
                      @click="exportNovelCrawlerJson"
                      class="export-btn export-json"
                    >
                      <template #icon><CodeOutlined /></template>
                      导出为 JSON 文件
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- Logs & Failures Section -->
              <a-collapse v-if="novelCrawlLogs.length > 0 || novelCrawlFailures.length > 0" class="novel-logs-collapse">
                <a-collapse-panel key="logs" header="运行日志与错误记录">
                  <div class="logs-toolbar">
                    <a-space>
                      <a-button
                        size="small"
                        :disabled="novelCrawlFailures.length === 0"
                        @click="
                          downloadFile(
                            'novel-failures.json',
                            JSON.stringify(novelCrawlFailures, null, 2)
                          )
                        "
                      >
                        <DownloadOutlined /> 导出失败记录
                      </a-button>
                      <a-button
                        size="small"
                        danger
                        :disabled="novelCrawlFailures.length === 0"
                        @click="novelCrawlFailures = []"
                      >
                        <DeleteOutlined /> 清空失败
                      </a-button>
                      <a-button
                        size="small"
                        danger
                        :disabled="novelCrawlLogs.length === 0"
                        @click="
                          novelCrawlLogs = [];
                          novelCrawlLogsText = '';
                        "
                      >
                        <DeleteOutlined /> 清空日志
                      </a-button>
                    </a-space>
                    <a-tag v-if="novelCrawlFailures.length" color="red">
                      失败: {{ novelCrawlFailures.length }}
                    </a-tag>
                  </div>

                  <!-- Failures List -->
                  <div v-if="novelCrawlFailures.length" class="failures-section">
                    <div class="subsection-title">失败记录（最多显示 20 条）</div>
                    <a-list
                      size="small"
                      bordered
                      :data-source="novelCrawlFailures.slice(0, 20)"
                      class="failures-list"
                    >
                      <template #renderItem="{ item }">
                        <a-list-item class="failure-item">
                          <div class="failure-info">
                            <div class="failure-header">
                              <CloseCircleOutlined style="color: #ef4444; margin-right: 6px" />
                              <span class="failure-time">{{ item.time }}</span>
                              <span class="failure-error">{{ item.error }}</span>
                            </div>
                            <div class="failure-url">{{ item.url }}</div>
                          </div>
                        </a-list-item>
                      </template>
                    </a-list>
                  </div>

                  <!-- Logs Textarea -->
                  <div class="logs-section">
                    <div class="subsection-title">运行日志</div>
                    <a-textarea
                      :value="novelCrawlLogsText"
                      readonly
                      :auto-size="{ minRows: 8, maxRows: 16 }"
                      class="logs-textarea"
                      placeholder="暂无日志"
                    />
                  </div>
                </a-collapse-panel>
              </a-collapse>
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
          <a-input
            v-model:value="proxyUrl"
            placeholder="例如 http://127.0.0.1:7890"
          />
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
          <div
            v-for="(header, index) in requestHeaders"
            :key="index"
            class="header-row"
          >
            <a-input
              v-model:value="header.key"
              placeholder="Key"
              class="header-input"
            />
            <span class="colon">:</span>
            <a-input
              v-model:value="header.value"
              placeholder="Value"
              class="header-input"
            />
            <a-button
              type="text"
              danger
              size="small"
              @click="removeHeader(index)"
            >
              <DeleteOutlined />
            </a-button>
          </div>
        </div>
        <a-button
          type="dashed"
          block
          @click="addHeader"
          style="margin-top: 10px"
        >
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
            <a-button type="primary" @click="downloadCode"
              ><DownloadOutlined /> 下载文件</a-button
            >
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
      @ok="
        templateModalMode === 'save'
          ? confirmSaveTemplate()
          : confirmLoadTemplate()
      "
    >
      <div v-if="templateModalMode === 'save'" class="template-modal-body">
        <a-form layout="vertical">
          <a-form-item label="模板名称">
            <a-input
              v-model:value="templateNameInput"
              placeholder="例如 电商列表-详情"
            />
          </a-form-item>
        </a-form>
      </div>
      <div v-else class="template-modal-body">
        <a-form layout="vertical">
          <a-form-item label="选择模板">
            <a-select
              v-model:value="selectedTemplateId"
              :options="templateOptions"
              placeholder="请选择"
            />
          </a-form-item>
          <div class="template-load-actions">
            <a-button
              danger
              @click="deleteSelectedTemplate"
              :disabled="!selectedTemplateId"
              >删除该模板</a-button
            >
          </div>
        </a-form>
      </div>
    </a-modal>

    <a-modal
      v-model:open="previewModalVisible"
      title="章节内容预览"
      width="700px"
      :footer="null"
    >
      <div v-if="previewLoading" class="preview-loading">
        <a-spin size="large" tip="正在加载内容..." />
      </div>
      <div v-else class="chapter-preview-content">
        <h2 class="preview-title">{{ previewResult.title }}</h2>
        <div class="preview-meta">{{ previewResult.url }}</div>
        <div class="preview-body">{{ previewResult.content }}</div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="helpModalVisible"
      title="使用说明"
      width="920px"
      :footer="null"
    >
      <div class="help-modal-body">
        <h3>快速流程</h3>
        <ol>
          <li>输入 URL，点击「加载页面」或按 <kbd>Ctrl+Enter</kbd></li>
          <li>切换到「选取模式」<kbd>Ctrl+I</kbd>，在预览页点击元素生成选择器</li>
          <li>在「字段配置」里配置字段名、属性类型与清洗规则</li>
          <li>在「数据预览」里验证单条/列表提取结果</li>
          <li>
            在「任务执行」里批量抓取并导出 JSON/CSV 或「生成代码」<kbd>Ctrl+K</kbd> 导出脚本
          </li>
        </ol>

        <h3>键盘快捷键</h3>
        <div class="shortcuts-grid">
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>L</kbd>
            <span>聚焦 URL 输入框</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>I</kbd>
            <span>切换选取模式</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>R</kbd>
            <span>刷新页面</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>S</kbd>
            <span>保存配置</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>K</kbd>
            <span>生成代码</span>
          </div>
          <div class="shortcut-item">
            <kbd>ESC</kbd>
            <span>关闭弹窗/退出选取</span>
          </div>
        </div>

        <h3>顶部按钮</h3>
        <ul>
          <li>
            <b>加载页面</b>：请求网页并在左侧 iframe 展示,同时更新预览解析源
            HTML。
          </li>
          <li>
            <b>请求设置</b>：配置
            Headers、超时、代理、证书策略,影响加载与任务执行。
          </li>
          <li><b>生成代码</b>：生成 Node.js(Cheerio)/Python(BS4) 脚本。</li>
          <li><b>规则管理</b>：导入/导出规则配置；保存/加载本地模板。</li>
        </ul>

        <h3>字段配置</h3>
        <ul>
          <li><b>selector</b>：CSS 选择器,来自选取模式或手动填写。</li>
          <li><b>属性</b>：text/html/href/src/custom。</li>
          <li><b>清洗</b>：trim/regex/replace。</li>
          <li><b>准星按钮</b>：在预览页高亮该选择器,快速确认是否选对。</li>
        </ul>

        <h3>数据预览</h3>
        <ul>
          <li><b>单条模式</b>：整页提取 1 条数据对象。</li>
          <li>
            <b>列表模式</b>：通过 listSelector 找到列表项,对每个 item
            提取字段。
          </li>
        </ul>

        <h3>任务执行</h3>
        <ul>
          <li><b>起始 URL</b>：每行一个 URL,可导入队列。</li>
          <li><b>并发/间隔/重试</b>：控制抓取速度与稳定性。</li>
          <li><b>链接发现</b>：从页面中按选择器提取链接并加入队列。</li>
          <li><b>下一页</b>：按选择器提取下一页链接并加入队列。</li>
          <li><b>暂停/继续</b>：临时暂停请求,继续后恢复。</li>
          <li><b>更多设置</b>：结果去重、启动前清空结果/日志/失败等。</li>
          <li>
            <b>任务面板</b>：查看正在抓取、待抓取队列、失败记录与运行日志。
          </li>
        </ul>

        <h3>小说爬虫</h3>
        <ul>
          <li><b>目录解析</b>：解析小说章节目录,批量获取章节链接。</li>
          <li><b>后端导出</b>：由后端高效抓取并生成 TXT/JSON 文件,速度快且不卡顿。</li>
          <li><b>自定义清洗</b>：支持正则表达式清洗章节内容中的广告和无用文本。</li>
        </ul>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
} from "vue";
import { message } from "ant-design-vue";
import { useScraperPreview } from "../composables/scraper/useScraperPreview";
import { useScraperInspector } from "../composables/scraper/useScraperInspector";
import { useScraperCrawlTask } from "../composables/scraper/useScraperCrawlTask";
import { useScraperCodegen } from "../composables/scraper/useScraperCodegen";
import { useScraperConfigStorage } from "../composables/scraper/useScraperConfigStorage";
import { useScraperApiMode } from "../composables/scraper/useScraperApiMode";
import { useScraperNovelDirectory } from "../composables/scraper/useScraperNovelDirectory";
import { useScraperNovelActions } from "../composables/scraper/useScraperNovelActions";
import {
  buildHeadersObject,
  downloadFile,
  normalizedUrl,
  sleep,
} from "../composables/scraper/utils";
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
  StopOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  QuestionCircleOutlined,
  ApiOutlined,
  BookOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  FilterOutlined,
  CleanOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons-vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

// --- State ---
const targetUrl = ref("");
const requestMethod = ref("GET");
const loading = ref(false);
const rawHtml = ref("");
const processedHtml = ref("");
const previewFrame = ref(null);
const urlInputRef = ref(null);
const isInspectorActive = ref(false);
const isMobileView = ref(false);
const activeTab = ref("fields");

const novelTitleSelector = ref("h1");
const novelContentSelector = ref("#content");
const novelExportIncludeUrlLine = ref(false);

const novelJsonKeyTitle = ref("title");
const novelJsonKeyContent = ref("content");
const novelJsonKeyUrl = ref("url");

const novelCleanEnabled = ref(false);
const novelCleanRegexText = ref(
  "app2\\(\\);\nread2\\(\\);\nchaptererror\\(\\);"
);

const novelCrawlResultsCount = ref(0);
const novelCrawlRunning = ref(false);
const novelCrawlProcessed = ref(0);
const novelCrawlQueueRemaining = ref(0);
const novelCrawlMaxPages = ref(5000);
const novelCrawlConcurrency = ref(3);
const novelCrawlDelayMs = ref(300);
const novelCrawlRetry = ref(1);
const novelCrawlFailures = ref([]);
const novelCrawlLogs = ref([]);
const novelCrawlLogsText = ref("");

const novelCrawlCurrentRunId = ref(0);

let unlistenNovelCrawlProgress = null;
let unlistenNovelCrawlFinished = null;

let novelProgressLogLastTs = 0;
let novelProgressLogLastProcessed = 0;

const pushNovelCrawlLog = (text) => {
  const line = `[${new Date().toLocaleTimeString()}] ${text}`;
  novelCrawlLogs.value.push(line);
  if (novelCrawlLogs.value.length > 500) {
    novelCrawlLogs.value.splice(0, novelCrawlLogs.value.length - 500);
  }
  novelCrawlLogsText.value = novelCrawlLogs.value.slice(-200).join("\n");
};

const ensureNovelCrawlListeners = async () => {
  if (unlistenNovelCrawlProgress || unlistenNovelCrawlFinished) return;

  unlistenNovelCrawlProgress = await listen("novel-crawl-progress", (event) => {
    const p = event?.payload || {};
    if (typeof p.processed === "number")
      novelCrawlProcessed.value = p.processed;
    if (typeof p.succeeded === "number")
      novelCrawlResultsCount.value = p.succeeded;
    if (typeof p.total === "number") {
      novelCrawlQueueRemaining.value = Math.max(
        0,
        p.total - (p.processed || 0)
      );
    }

    const now = Date.now();
    const processed = Number(p.processed || 0);
    const total = Number(p.total || 0);
    const isFailed =
      p.message === "failed" || (typeof p.error === "string" && !!p.error);
    const shouldLog =
      isFailed ||
      (p.url &&
        (now - novelProgressLogLastTs > 800 ||
          processed - novelProgressLogLastProcessed >= 10));

    if (shouldLog) {
      novelProgressLogLastTs = now;
      novelProgressLogLastProcessed = processed;
      if (p.url) pushNovelCrawlLog(`进度: ${processed}/${total} ${p.url}`);
      if (isFailed) {
        if (p.url) {
          novelCrawlFailures.value.push({
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            time: new Date().toLocaleTimeString(),
            url: String(p.url),
            error: String(p.error || "unknown"),
          });
        }
        pushNovelCrawlLog(
          `失败: ${String(p.url || "")} ${String(p.error || "unknown")}`.trim()
        );
      }
    }
  });

  unlistenNovelCrawlFinished = await listen("novel-crawl-finished", (event) => {
    const p = event?.payload || {};
    novelCrawlRunning.value = false;
    novelCrawlCurrentRunId.value = 0;
    if (typeof p.processed === "number")
      novelCrawlProcessed.value = p.processed;
    if (typeof p.succeeded === "number")
      novelCrawlResultsCount.value = p.succeeded;
    if (typeof p.total === "number") {
      novelCrawlQueueRemaining.value = Math.max(
        0,
        p.total - (p.processed || 0)
      );
    }
    if (p.canceled) {
      pushNovelCrawlLog("导出任务已停止");
    } else {
      pushNovelCrawlLog("导出任务结束");
    }
  });
};

const cancelNovelExport = async () => {
  const rid = Number(novelCrawlCurrentRunId.value || 0);
  if (!rid) {
    message.info("当前没有可停止的任务");
    return;
  }
  try {
    await invoke("novel_crawl_cancel", { runId: rid });
    pushNovelCrawlLog(`已请求停止任务: ${rid}`);
  } catch (_) {
    message.error("停止失败");
  }
};

const apiMode = ref({
  enabled: false,
  method: "GET",
  url: "",
  dataPath: "",
  headers: [],
  body: "",
  extract: [],
  pagination: { type: "none" },
});

// --- Advanced Settings ---
const settingsVisible = ref(false);
const requestHeaders = ref([
  {
    key: "User-Agent",
    value:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  },
]);
const requestTimeout = ref(10000);
const proxyUrl = ref("");
const acceptInvalidCerts = ref(false);

const autoExitOnPick = ref(false);
const autoAdvanceOnPick = ref(false);
const PICK_SETTINGS_KEY = "scraper:pickSettings:v1";

// --- Data Preview Options ---
const previewViewMode = ref("json"); // 'json' | 'table'

const fields = reactive([
  {
    name: "title",
    selector: "h1",
    attr: "text",
    customAttr: "",
    transformType: "none",
    transformPattern: "",
    transformReplacement: "",
  },
]);
const currentFieldIndex = ref(0);

const listMode = ref(false);
const listSelector = ref("");

const updatedFields = ref(new Set());

const triggerFieldFlash = (index) => {
  updatedFields.value.add(index);
  setTimeout(() => {
    updatedFields.value.delete(index);
  }, 1000);
};

const {
  hasPreviewData,
  previewCountText,
  previewDataJson,
  fieldSampleText,
  refreshPreview,
  scheduleRefreshPreview,
  copyPreviewData,
  exportData,
  detectListSelector,
  getParsedDoc,
  extractValue,
  fieldDiagnostics,
  fieldDiagnosticText,
  fieldDiagnosticColor,
  disposePreview,
} = useScraperPreview({
  rawHtml,
  processedHtml,
  targetUrl,
  fields,
  listMode,
  listSelector,
  messageApi: message,
});

const {
  loading: apiLoading,
  responseStatus: apiResponseStatus,
  responseStatusText: apiResponseStatusText,
  responseText: apiResponseText,
  responseError: apiResponseError,
  responseTimeMs: apiResponseTimeMs,
  extractedJson: apiExtractedJson,
  hasExtracted: apiHasExtracted,
  runRequest: runApiRequest,
  addApiHeader,
  removeApiHeader,
  addExtractField,
  removeExtractField,
} = useScraperApiMode({
  apiMode,
  messageApi: message,
});

const {
  injectInspectorScript,
  highlightSelectorInPreview,
  handleMessage: handleInspectorMessage,
} = useScraperInspector({
  rawHtml,
  processedHtml,
  previewFrame,
  isInspectorActive,
  fields,
  currentFieldIndex,
  autoAdvanceOnPick,
  autoExitOnPick,
  getParsedDoc,
  scheduleRefreshPreview,
  triggerFieldFlash,
  messageApi: message,
});

const scrollToField = async (index) => {
  await nextTick();
  const el = document.querySelector(`.field-card[data-index="${index}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
};

watch(currentFieldIndex, (newVal) => {
  scrollToField(newVal);
});

const codeModalVisible = ref(false);
const codeLanguage = ref("node");

const { generatedCode, showCodeModal, copyCode, downloadCode } =
  useScraperCodegen({
    targetUrl,
    fields,
    listMode,
    listSelector,
    requestHeaders,
    codeLanguage,
    codeModalVisible,
    messageApi: message,
  });

const helpModalVisible = ref(false);

const startUrlsText = ref("");
const crawlQueue = ref([]);
const crawlResults = ref([]);
const crawlRunning = ref(false);
const crawlProcessed = ref(0);
const crawlMaxPages = ref(200);
const crawlConcurrency = ref(5);
const crawlDelayMs = ref(300);
const crawlRetry = ref(1);
const discoverLinksSelector = ref("");
const discoverLinksAttr = ref("href");
const discoverLinksCustomAttr = ref("");
const nextPageSelector = ref("");
const nextPageAttr = ref("href");
const nextPageCustomAttr = ref("");
const crawlRunId = ref(0);

const crawlPaused = ref(false);
const crawlActiveUrls = ref([]);
const crawlFailures = ref([]);
const crawlLogs = ref([]);
const crawlDedupEnabled = ref(true);
const crawlDedupKey = ref("__url");
const crawlClearOnStart = ref(false);

const {
  urlHistory,
  urlHistoryOptions,
  loadUrlHistory,
  addToHistory,
  clearUrlHistory,
  onSelectHistoryUrl,

  templates,
  templateModalVisible,
  templateModalMode,
  templateNameInput,
  selectedTemplateId,
  templateOptions,
  loadTemplates,
  openSaveTemplate,
  openLoadTemplate,
  confirmSaveTemplate,
  confirmLoadTemplate,
  deleteSelectedTemplate,

  fileInput,
  exportRules,
  triggerImport,
  importRules,

  loadLastConfig,
  disposeStorage,
} = useScraperConfigStorage({
  targetUrl,
  requestMethod,
  fields,
  listMode,
  listSelector,
  requestHeaders,
  requestTimeout,
  proxyUrl,
  acceptInvalidCerts,
  autoExitOnPick,
  autoAdvanceOnPick,
  startUrlsText,
  crawlMaxPages,
  crawlConcurrency,
  crawlDelayMs,
  crawlRetry,
  discoverLinksSelector,
  discoverLinksAttr,
  discoverLinksCustomAttr,
  nextPageSelector,
  nextPageAttr,
  nextPageCustomAttr,
  crawlDedupEnabled,
  crawlDedupKey,
  crawlClearOnStart,
  apiMode,
  onConfigApplied: () => {
    scheduleRefreshPreview();
  },
  messageApi: message,
});

const buildRequestHeadersObject = () => {
  return buildHeadersObject(requestHeaders.value);
};

const canFetch = computed(() => {
  const url = targetUrl.value?.trim();
  return !loading.value && !!url && url.length > 0;
});

const {
  clearCrawlLogs,
  clearCrawlFailures,
  exportCrawlFailures,
  exportCrawlData,
  crawlFailureColumns,
  crawlQueuePreview,
  crawlDedupKeyOptions,
  crawlTableColumns,
  useCurrentUrlAsStart,
  importStartUrlsToQueue,
  clearCrawlQueue,
  clearCrawlResults,
  togglePauseCrawl,
  stopCrawl,
  startCrawl,
} = useScraperCrawlTask({
  targetUrl,
  startUrlsText,
  crawlQueue,
  crawlResults,
  crawlRunning,
  crawlProcessed,
  crawlMaxPages,
  crawlConcurrency,
  crawlDelayMs,
  crawlRetry,
  discoverLinksSelector,
  discoverLinksAttr,
  discoverLinksCustomAttr,
  nextPageSelector,
  nextPageAttr,
  nextPageCustomAttr,
  crawlRunId,
  crawlPaused,
  crawlActiveUrls,
  crawlFailures,
  crawlLogs,
  crawlDedupEnabled,
  crawlDedupKey,
  crawlClearOnStart,
  fields,
  listMode,
  listSelector,
  requestHeaders,
  requestTimeout,
  proxyUrl,
  acceptInvalidCerts,
  invoke,
  save,
  writeTextFile,
  extractValue,
  messageApi: message,
});

const {
  directoryUrl,
  linkSelector: novelLinkSelector,
  linkAttr: novelLinkAttr,
  sameDomainOnly: novelSameDomainOnly,
  includePattern: novelIncludePattern,
  excludePattern: novelExcludePattern,
  maxItems: novelMaxItems,
  parsing: novelParsing,
  parseError: novelParseError,
  chapters: novelChapters,
  canParse: novelCanParse,
  parseDirectory: parseNovelDirectory,
} = useScraperNovelDirectory({
  invoke,
  buildRequestHeadersObject,
  requestTimeout,
  proxyUrl,
  acceptInvalidCerts,
  messageApi: message,
});

const {
  previewModalVisible,
  previewLoading,
  previewResult,
  previewChapter,
  rangeStart,
  rangeEnd,
  getFilteredChapters
} = useScraperNovelActions({
  invoke,
  messageApi: message,
  buildRequestHeadersObject,
  requestTimeout,
  proxyUrl,
  acceptInvalidCerts
});

const exportNovelCrawlerTxt = async () => {
  try {
    await ensureNovelCrawlListeners();
    const chaptersToExport = getFilteredChapters(novelChapters.value);
    
    const urls = (Array.isArray(chaptersToExport) ? chaptersToExport : [])
      .map((x) => x?.url)
      .filter(Boolean)
      .map((u) => normalizedUrl(u))
      .filter(Boolean);
    if (!urls.length) {
      message.warning("没有可导出的章节链接（请先解析目录或检查范围设置）");
      return;
    }

    const filePath = await save({
      defaultPath: "novel.txt",
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (!filePath) return;

    novelCrawlRunning.value = true;
    novelCrawlProcessed.value = 0;
    novelCrawlQueueRemaining.value = urls.length;
    pushNovelCrawlLog(`开始后端导出 TXT (共 ${urls.length} 章)`);

    const runId = await invoke("novel_crawl_export", {
      req: {
        urls,
        outputPath: filePath,
        exportFormat: "txt",
        titleSelector: String(novelTitleSelector.value || "").trim(),
        contentSelector: String(novelContentSelector.value || "").trim(),
        headers: buildRequestHeadersObject(),
        timeoutMs: requestTimeout.value,
        proxyUrl: proxyUrl.value,
        acceptInvalidCerts: acceptInvalidCerts.value,
        concurrency: Number(novelCrawlConcurrency.value || 1),
        delayMs: Number(novelCrawlDelayMs.value || 0),
        retry: Number(novelCrawlRetry.value || 0),
        maxPages: Number(novelCrawlMaxPages.value || 0),
        includeUrlLine: !!novelExportIncludeUrlLine.value,
        cleanRegexLines: novelCleanEnabled.value
          ? String(novelCleanRegexText.value || "")
              .split(/\r?\n/)
              .map((x) => x.trim())
              .filter(Boolean)
          : [],
        jsonKeys: {
          title: String(novelJsonKeyTitle.value || "title").trim() || "title",
          content:
            String(novelJsonKeyContent.value || "content").trim() || "content",
          url: String(novelJsonKeyUrl.value || "url").trim() || "url",
        },
      },
    });
    novelCrawlCurrentRunId.value = Number(runId || 0);
    message.info("已提交后端任务，正在导出...");
  } catch (_) {
    message.error("导出失败");
  }
};

const exportNovelCrawlerJson = async () => {
  try {
    await ensureNovelCrawlListeners();
    const chaptersToExport = getFilteredChapters(novelChapters.value);

    const urls = (Array.isArray(chaptersToExport) ? chaptersToExport : [])
      .map((x) => x?.url)
      .filter(Boolean)
      .map((u) => normalizedUrl(u))
      .filter(Boolean);
    if (!urls.length) {
      message.warning("没有可导出的章节链接（请先解析目录或检查范围设置）");
      return;
    }

    const filePath = await save({
      defaultPath: "novel.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return;

    novelCrawlRunning.value = true;
    novelCrawlProcessed.value = 0;
    novelCrawlQueueRemaining.value = urls.length;
    pushNovelCrawlLog(`开始后端导出 JSON (共 ${urls.length} 章)`);

    const runId = await invoke("novel_crawl_export", {
      req: {
        urls,
        outputPath: filePath,
        exportFormat: "json",
        titleSelector: String(novelTitleSelector.value || "").trim(),
        contentSelector: String(novelContentSelector.value || "").trim(),
        headers: buildRequestHeadersObject(),
        timeoutMs: requestTimeout.value,
        proxyUrl: proxyUrl.value,
        acceptInvalidCerts: acceptInvalidCerts.value,
        concurrency: Number(novelCrawlConcurrency.value || 1),
        delayMs: Number(novelCrawlDelayMs.value || 0),
        retry: Number(novelCrawlRetry.value || 0),
        maxPages: Number(novelCrawlMaxPages.value || 0),
        includeUrlLine: false,
        cleanRegexLines: novelCleanEnabled.value
          ? String(novelCleanRegexText.value || "")
              .split(/\r?\n/)
              .map((x) => x.trim())
              .filter(Boolean)
          : [],
        jsonKeys: {
          title: String(novelJsonKeyTitle.value || "title").trim() || "title",
          content:
            String(novelJsonKeyContent.value || "content").trim() || "content",
          url: String(novelJsonKeyUrl.value || "url").trim() || "url",
        },
      },
    });
    novelCrawlCurrentRunId.value = Number(runId || 0);
    message.info("已提交后端任务，正在导出...");
  } catch (_) {
    message.error("导出失败");
  }
};

const pasteUrl = async () => {
  try {
    const text = await navigator.clipboard.readText();
    const trimmedText = text?.trim();

    if (!trimmedText) {
      message.info("剪贴板内容为空");
      return;
    }

    targetUrl.value = trimmedText;
    message.success("已粘贴网址");

    // Auto-focus URL input for quick editing
    await nextTick();
    urlInputRef.value?.focus?.();
  } catch (e) {
    console.error("Paste error:", e);
    message.error("粘贴失败（可能无权限）");
  }
};

const clearTargetUrl = () => {
  targetUrl.value = "";
  // Focus the URL input after clearing
  nextTick(() => {
    urlInputRef.value?.focus?.();
  });
  message.info("已清空网址");
};

const openInBrowser = () => {
  const u = normalizedUrl(targetUrl.value);

  if (!u) {
    message.warning("请输入有效的网址");
    return;
  }

  try {
    window.open(u, "_blank", "noopener,noreferrer");
    message.success("已在新标签页打开");
  } catch (e) {
    console.error("Open browser error:", e);
    message.error("打开浏览器失败");
  }
};

// --- Settings Logic ---
const addHeader = () => {
  requestHeaders.value.push({ key: "", value: "" });
};

const removeHeader = (index) => {
  requestHeaders.value.splice(index, 1);
};

// --- Browser & Inspector Logic ---

const formatFetchError = (err) => {
  try {
    if (!err) return "网络请求失败";

    if (typeof err === "string") {
      return err.length > 200 ? `${err.substring(0, 200)}...` : err;
    }

    if (err instanceof Error) {
      const parts = [];

      if (err.name && err.name !== "Error") parts.push(`[${err.name}]`);
      if (err.message) parts.push(err.message);

      const causeMsg =
        typeof err.cause === "string"
          ? err.cause
          : err.cause && typeof err.cause === "object" && "message" in err.cause
          ? err.cause.message
          : "";

      if (causeMsg) parts.push(`原因: ${causeMsg}`);

      const result = parts.join(" | ") || "网络请求失败";
      return result.length > 200 ? `${result.substring(0, 200)}...` : result;
    }

    if (typeof err === "object") {
      const msg = err.message || err.toString?.() || JSON.stringify(err);
      return msg.length > 200 ? `${msg.substring(0, 200)}...` : msg;
    }

    const str = String(err);
    return str.length > 200 ? `${str.substring(0, 200)}...` : str;
  } catch (formatError) {
    console.error("Error formatting error message:", formatError);
    return "网络请求失败（错误信息格式化失败）";
  }
};

const fetchPage = async () => {
  const url = targetUrl.value?.trim();

  if (!url) {
    message.warning("请输入目标网址");
    return;
  }

  // Normalize URL before fetching
  targetUrl.value = normalizedUrl(url);

  if (!targetUrl.value) {
    message.error("无效的网址格式");
    return;
  }

  loading.value = true;
  isInspectorActive.value = false;

  try {
    const html = await invoke("fetch_url_decoded", {
      req: {
        url: targetUrl.value,
        headers: buildRequestHeadersObject(),
        timeoutMs: requestTimeout.value,
        proxyUrl: proxyUrl.value,
        acceptInvalidCerts: acceptInvalidCerts.value,
      },
    });
    rawHtml.value = html;
    processedHtml.value = injectInspectorScript(html, targetUrl.value);
    addToHistory(targetUrl.value);

    message.success("页面加载成功");
    await nextTick();
    scheduleRefreshPreview();
  } catch (error) {
    console.error("Scraper fetchPage error:", {
      error,
      name: error?.name,
      message: error?.message,
      cause: error?.cause,
      stack: error?.stack,
    });
    message.error(
      `加载失败: ${formatFetchError(error)}（可能与代理/证书/DNS有关）`
    );
  } finally {
    loading.value = false;
  }
};

const handleKeydown = (e) => {
  const key = (e.key || "").toLowerCase();
  const isMac =
    navigator.platform && navigator.platform.toLowerCase().includes("mac");
  const mod = isMac ? e.metaKey : e.ctrlKey;

  // ESC key - close modals
  if (key === "escape") {
    isInspectorActive.value = false;
    if (codeModalVisible.value) codeModalVisible.value = false;
    if (settingsVisible.value) settingsVisible.value = false;
    if (helpModalVisible.value) helpModalVisible.value = false;
    if (templateModalVisible.value) templateModalVisible.value = false;
    return;
  }

  if (!mod) return;

  // Ctrl/Cmd + L - Focus URL input
  if (key === "l") {
    e.preventDefault();
    urlInputRef.value?.focus?.();
    urlInputRef.value?.select?.();
  }
  // Ctrl/Cmd + I - Toggle inspector mode
  else if (key === "i") {
    e.preventDefault();
    isInspectorActive.value = !isInspectorActive.value;
    message.info(`选取模式: ${isInspectorActive.value ? "开启" : "关闭"}`);
  }
  // Ctrl/Cmd + R - Refresh page
  else if (key === "r") {
    e.preventDefault();
    if (targetUrl.value && !loading.value) {
      fetchPage();
    }
  }
  // Ctrl/Cmd + S - Save configuration
  else if (key === "s") {
    e.preventDefault();
    exportRules();
  }
  // Ctrl/Cmd + K - Generate code
  else if (key === "k") {
    e.preventDefault();
    showCodeModal();
  }
};

// Watch field changes to trigger preview refresh (debounced)
let fieldChangeTimer = null;
watch(
  () => fields.map((f) => ({ selector: f.selector, attr: f.attr, customAttr: f.customAttr })),
  () => {
    if (fieldChangeTimer) clearTimeout(fieldChangeTimer);
    fieldChangeTimer = setTimeout(() => {
      scheduleRefreshPreview();
    }, 500); // Debounce 500ms
  },
  { deep: true }
);

watch([listMode, listSelector], () => {
  scheduleRefreshPreview();
});

onMounted(() => {
  window.addEventListener("message", handleInspectorMessage);
  window.addEventListener("keydown", handleKeydown);
  loadUrlHistory();
  loadTemplates();

  loadLastConfig();

  try {
    const raw = localStorage.getItem(PICK_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.autoExitOnPick === "boolean")
        autoExitOnPick.value = parsed.autoExitOnPick;
      if (typeof parsed.autoAdvanceOnPick === "boolean")
        autoAdvanceOnPick.value = parsed.autoAdvanceOnPick;
    }
  } catch (e) {
    // ignore
  }
});

watch([autoExitOnPick, autoAdvanceOnPick], () => {
  try {
    localStorage.setItem(
      PICK_SETTINGS_KEY,
      JSON.stringify({
        autoExitOnPick: autoExitOnPick.value,
        autoAdvanceOnPick: autoAdvanceOnPick.value,
      })
    );
  } catch (e) {
    // ignore
  }
});

onUnmounted(() => {
  window.removeEventListener("message", handleInspectorMessage);
  window.removeEventListener("keydown", handleKeydown);

  // Clear timers
  if (fieldChangeTimer) clearTimeout(fieldChangeTimer);

  try {
    if (unlistenNovelCrawlProgress) unlistenNovelCrawlProgress();
  } catch (_) {}
  try {
    if (unlistenNovelCrawlFinished) unlistenNovelCrawlFinished();
  } catch (_) {}

  stopCrawl();
  disposePreview();
  disposeStorage();
});

// --- Field Management ---
const addField = () => {
  const newField = {
    name: `field_${fields.length + 1}`,
    selector: "",
    attr: "text",
    customAttr: "",
    transformType: "none",
    transformPattern: "",
    transformReplacement: "",
  };

  fields.push(newField);
  currentFieldIndex.value = fields.length - 1;

  // Scroll to new field after creation
  nextTick(() => {
    scrollToField(fields.length - 1);
  });

  message.success("已添加新字段");
};

const removeField = (index) => {
  if (index < 0 || index >= fields.length) {
    message.error("无效的字段索引");
    return;
  }

  const fieldName = fields[index]?.name || "字段";

  fields.splice(index, 1);

  // Adjust currentFieldIndex after removal
  if (currentFieldIndex.value >= fields.length) {
    currentFieldIndex.value = Math.max(0, fields.length - 1);
  } else if (index < currentFieldIndex.value) {
    currentFieldIndex.value--;
  }

  message.success(`已删除字段: ${fieldName}`);
};

const moveField = (index, direction) => {
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= fields.length) {
    message.warning("无法移动字段");
    return;
  }

  // Swap fields
  const temp = fields[index];
  fields[index] = fields[newIndex];
  fields[newIndex] = temp;

  // Update current field index
  if (currentFieldIndex.value === index) {
    currentFieldIndex.value = newIndex;
  } else if (currentFieldIndex.value === newIndex) {
    currentFieldIndex.value = index;
  }

  message.success(`已${direction > 0 ? "下移" : "上移"}字段`);
};

const duplicateField = (index) => {
  if (index < 0 || index >= fields.length) {
    message.error("无效的字段索引");
    return;
  }

  const field = fields[index];
  const duplicatedField = JSON.parse(JSON.stringify(field));

  // Modify the name to indicate it's a copy
  duplicatedField.name = `${field.name}_copy`;

  fields.splice(index + 1, 0, duplicatedField);
  currentFieldIndex.value = index + 1;

  nextTick(() => {
    scrollToField(index + 1);
  });

  message.success("已复制字段");
};

const copyFieldSelector = async (index) => {
  const selector = fields[index]?.selector;

  if (!selector || typeof selector !== "string" || !selector.trim()) {
    message.info("暂无可复制的选择器");
    return;
  }

  try {
    await navigator.clipboard.writeText(selector);
    message.success("选择器已复制到剪贴板");
  } catch (e) {
    console.error("Copy selector error:", e);
    message.error("复制失败（可能无权限）");
  }
};

const clearFieldSelector = (index) => {
  if (fields[index]) {
    fields[index].selector = "";
    message.info("已清空选择器");
    scheduleRefreshPreview();
  }
};

const tableColumns = computed(() => {
  const columns = fields
    .filter((f) => f?.name)
    .map((f) => ({
      title: f.name,
      dataIndex: f.name,
      key: f.name,
      ellipsis: true,
      width: 150
    }));
  return columns;
});

const highlightFieldSelector = (index) => {
  if (!fields[index]) {
    message.error("字段不存在");
    return;
  }

  const selector = fields[index].selector;

  if (!selector || !selector.trim()) {
    message.warning("选择器为空，请先设置选择器");
    return;
  }

  if (!processedHtml.value) {
    message.warning("请先加载页面");
    return;
  }

  highlightSelectorInPreview(selector);
  message.info("已在预览中高亮显示");
};
</script>

<style scoped>
/* Define local variables for the new theme */
.scraper-container {
  --bg-color: #f3f4f6;
  --panel-bg: #ffffff;
  --border-color: #e5e7eb;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --accent-color: #3b82f6;
  --accent-light: rgba(59, 130, 246, 0.1);
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --radius-md: 8px;
  --radius-lg: 12px;
  --glass-bg: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(255, 255, 255, 0.5);

  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  color: var(--text-primary);
  background-color: var(--bg-color);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* --- Common Util Classes --- */
.glass-effect {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
}

/* --- Top Bar --- */
.control-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  gap: 20px;
  flex-shrink: 0;
  z-index: 20;
  background: var(--panel-bg);
}

.nav-left {
  flex: 1;
  max-width: 900px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-switch-wrapper {
  display: flex;
  align-items: center;
  background: #f3f4f6;
  padding: 2px;
  border-radius: 6px;
}

.nav-input-group {
  display: flex;
  align-items: center;
  width: 100%;
  background: #f9fafb;
  border-radius: 10px;
  padding: 4px 6px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
}

.nav-input-group:focus-within {
  border-color: var(--accent-color);
  background: white;
  box-shadow: 0 0 0 3px var(--accent-light);
}

.method-select {
  width: 90px;
}

:deep(.method-select .ant-select-selector) {
  background: transparent !important;
  font-weight: 700;
  color: var(--accent-color);
  height: 36px !important;
  display: flex;
  align-items: center;
  padding: 0 8px !important;
}

.divider-vertical {
  width: 1px;
  height: 24px;
  background: #e5e7eb;
  margin: 0 8px;
}

.url-input {
  flex: 1;
}

:deep(.url-input .ant-input) {
  background: transparent;
  font-size: 14px;
  height: 36px;
  font-weight: 500;
  color: #374151;
}

.text-icon {
  color: #9ca3af;
  margin-right: 4px;
}

.fetch-btn {
  border-radius: 8px !important;
  height: 36px;
  margin-left: 8px;
  padding: 0 24px;
  font-weight: 600;
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.25);
  border: none;
  transition: all 0.2s ease;
}

.fetch-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 8px rgba(59, 130, 246, 0.3);
}

.fetch-btn:active {
  transform: translateY(0);
}

.icon-btn {
  color: var(--text-secondary);
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  color: var(--accent-color);
  background: var(--accent-light);
  border-color: rgba(59, 130, 246, 0.2);
}

.icon-btn:disabled {
  color: #d1d5db;
  cursor: not-allowed;
  background: transparent;
}

/* --- Main Content --- */
.main-content {
  flex: 1;
  display: flex;
  gap: 20px;
  overflow: hidden;
}

.pane {
  background: var(--panel-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.pane-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  flex-shrink: 0;
}

.pane-title {
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
}

/* Browser Pane */
.browser-pane {
  flex: 3;
  background: #f1f5f9;
  position: relative;
  border: none; /* Let the viewport handle border */
  box-shadow: none;
  background: transparent;
}

.browser-pane .pane-header {
  background: transparent;
  border-bottom: none;
  padding: 0 0 12px 4px;
}

.browser-viewport-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  padding: 0 4px 4px 4px; /* Slight padding for shadow space */
}

.browser-viewport {
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #d1d5db;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.browser-viewport.mobile-view {
  width: 375px;
  height: 667px;
  border-radius: 32px;
  border: 12px solid #1f2937;
  align-self: center;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}

.browser-viewport.inspector-active {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.25), var(--shadow-lg);
}

.browser-address-bar {
  height: 44px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  flex-shrink: 0;
}

.traffic-lights {
  display: flex;
  gap: 8px;
}

.traffic-lights span {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.1);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.4);
}

.traffic-lights span:nth-child(1) { background: #ff5f56; border-color: #e0443e; }
.traffic-lights span:nth-child(2) { background: #ffbd2e; border-color: #dea123; }
.traffic-lights span:nth-child(3) { background: #27c93f; border-color: #1aab29; }

.fake-url {
  flex: 1;
  background: white;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  color: #4b5563;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) inset, 0 0 0 1px #e5e7eb inset;
}

.browser-reload-icon {
  color: #6b7280;
  cursor: pointer;
  transition: color 0.2s, transform 0.3s;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
}

.browser-reload-icon:hover {
  color: var(--accent-color);
  background: rgba(0,0,0,0.05);
  transform: rotate(30deg);
}

.browser-reload-icon.loading-spin {
  animation: spin 1s linear infinite;
  pointer-events: none;
  color: var(--accent-color);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  background: #f9fafb;
}

.empty-icon-bg {
  width: 96px;
  height: 96px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: #e5e7eb;
  margin-bottom: 24px;
  box-shadow: var(--shadow-md);
  border: 1px solid #f3f4f6;
}

.empty-state h3 {
  font-size: 18px;
  color: #374151;
  margin-bottom: 8px;
  font-weight: 700;
}

.empty-state p {
  font-size: 14px;
  color: #6b7280;
}

.inspector-badge {
  color: var(--accent-color);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  padding: 4px 12px;
  border-radius: 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--accent-light);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  animation: pulse-red 1.5s infinite;
}

@keyframes pulse-red {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  backdrop-filter: blur(4px);
}

/* Config Pane */
.config-pane {
  flex: 2;
  min-width: 350px;
  max-width: 480px;
}

.custom-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.ant-tabs-nav) {
  margin: 0 !important;
  padding: 0 20px;
  border-bottom: 1px solid #f3f4f6;
}

:deep(.ant-tabs-tab) {
  padding: 14px 0 !important;
  margin: 0 24px 0 0 !important;
  transition: color 0.3s;
}

:deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: var(--accent-color) !important;
  font-weight: 600;
}

:deep(.ant-tabs-ink-bar) {
  background: var(--accent-color) !important;
  height: 3px !important;
  border-radius: 3px 3px 0 0;
}

.tab-label {
  font-size: 14px;
}

:deep(.ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
  display: flex;
  background: #fcfcfc;
}

:deep(.ant-tabs-content),
:deep(.ant-tabs-tabpane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.config-content {
  flex: 1;
  min-height: 0;
  overflow-y: overlay; /* Better scrollbar handling */
  padding: 20px;
}

/* Fields List */
.fields-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 20px;
}

.field-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.field-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  transform: translateY(-2px);
}

.field-card.active {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-light), 0 4px 12px rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
  z-index: 1;
}

.field-card-header {
  padding: 10px 16px;
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border-bottom: 1px solid transparent;
  transition: background 0.2s;
}

.field-card:hover .field-card-header {
  background: #f3f4f6;
}

.field-card.active .field-card-header {
  border-bottom-color: #f3f4f6;
  background: #eff6ff;
}

.field-card.flash-success {
  animation: flash-success-anim 1s ease-out;
}

@keyframes flash-success-anim {
  0% {
    box-shadow: 0 0 0 2px #10b981;
    border-color: #10b981;
  }
  100% {
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0);
    border-color: #e5e7eb;
  }
}

.field-name {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.field-diag-tag {
  margin-left: 8px;
  font-size: 11px;
  line-height: 20px;
  border-radius: 4px;
  font-weight: 600;
}

.field-index {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 700;
  width: 24px;
  background: rgba(0,0,0,0.03);
  text-align: center;
  border-radius: 4px;
  line-height: 18px;
}

.divider-vertical-small {
  width: 1px;
  height: 16px;
  background: #e5e7eb;
  margin: 0 6px;
}

.field-name-input {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.field-actions {
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
}

.field-card:hover .field-actions,
.field-card.active .field-actions {
  opacity: 1;
}

.field-card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: white;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.selector-input-group :deep(.ant-input) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #0f172a;
  background: #f8fafc;
  font-size: 12px;
}

.aim-icon {
  cursor: pointer;
  color: #9ca3af;
  transition: all 0.2s;
  padding: 4px;
  border-radius: 4px;
}

.aim-icon:hover,
.aim-icon.active {
  color: white;
  background: var(--accent-color);
}

.selector-suffix {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.suffix-icon {
  cursor: pointer;
  color: #9ca3af;
  transition: color 0.2s;
  padding: 4px;
}

.suffix-icon:hover {
  color: var(--accent-color);
}

.field-sample {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
}

.sample-label {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 0 0 auto;
}

.sample-value {
  font-size: 13px;
  color: #1f2937;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
}

.data-clean-section {
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  border: 1px dashed #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: background 0.2s;
}

.data-clean-section:hover {
  background: #f3f4f6;
}

.section-title {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-field-btn {
  border-style: dashed;
  height: 44px;
  border-color: #d1d5db;
  color: #6b7280;
  font-weight: 500;
}

.add-field-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* Data Preview Tab Styles */
.data-tab-content {
  display: flex;
  flex-direction: column;
  padding: 0;
  background: #fff;
}

.data-toolbar {
  padding: 12px 20px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mode-label {
  font-size: 13px;
  color: #4b5563;
  font-weight: 500;
}

.list-selector-box {
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.box-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
  font-weight: 600;
}

.preview-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f3f4f6;
}

.display-controls {
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.display-area {
  flex: 1;
  margin: 0 20px 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  position: relative;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.json-view {
  height: 100%;
  overflow: auto;
  padding: 20px;
}

.json-view pre {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #1e293b;
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
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #9ca3af;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Scrollbar Customization */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.custom-scroll {
  overflow: auto;
}

/* Drawer Styles */
.section-divider {
  font-size: 12px;
  color: #9ca3af;
  margin: 20px 0 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 4px;
}

.headers-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pick-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.pick-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pick-setting-label {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 6px;
}

.colon {
  color: #9ca3af;
  font-weight: bold;
}

/* Code Modal */
.code-modal-body {
  height: 600px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.code-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.code-actions {
  display: flex;
  gap: 12px;
}

.code-editor-container {
  flex: 1;
  background: #0f172a;
  border-radius: 8px;
  padding: 20px;
  overflow: auto;
  color: #e2e8f0;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
}

.code-editor-container pre {
  margin: 0;
}

.template-modal-body {
  padding-top: 12px;
}

.template-load-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
}

.help-modal-body {
  max-height: 70vh;
  overflow: auto;
  padding-right: 12px;
}

.help-modal-body h3 {
  margin: 24px 0 12px;
  font-size: 16px;
  color: #111827;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-modal-body h3::before {
  content: '';
  width: 4px;
  height: 16px;
  background: var(--accent-color);
  border-radius: 2px;
  display: inline-block;
}

.help-modal-body ul,
.help-modal-body ol {
  margin: 0 0 16px;
  padding-left: 24px;
}

.help-modal-body li {
  line-height: 1.8;
  color: #374151;
  margin-bottom: 6px;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin: 16px 0;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-size: 14px;
}

.shortcut-item kbd {
  display: inline-block;
  padding: 3px 8px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  background: linear-gradient(to bottom, #f9fafb 0%, #e5e7eb 100%);
  border: 1px solid #d1d5db;
  border-radius: 4px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  line-height: 1.4;
  white-space: nowrap;
}

.shortcut-item span {
  color: #6b7280;
  flex: 1;
}

.task-tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #f9fafb;
}

.task-section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.task-section-title {
  font-size: 13px;
  color: #111827;
  margin-bottom: 12px;
  font-weight: 700;
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 8px;
}

.task-actions-row {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.task-stats-row {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.task-grid-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-subgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.task-subgrid-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.task-empty {
  padding: 24px;
  border-radius: 8px;
  border: 1px dashed #d1d5db;
  color: #9ca3af;
  background: #f9fafb;
  text-align: center;
}

.task-popover {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}

.task-popover-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.task-panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.task-panel-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-panel-title {
  font-size: 13px;
  color: #374151;
  font-weight: 600;
}

.task-log-box {
  border: 1px solid #1f2937;
  border-radius: 6px;
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px;
  max-height: 300px;
  overflow: auto;
  font-family: 'JetBrains Mono', monospace;
}

.task-log-line {
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 2px;
}

.empty-fields-state {
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  margin-bottom: 16px;
}

.empty-fields-state .empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  color: #d1d5db;
}

.empty-fields-state .empty-text {
  font-size: 14px;
}

/* List Transition */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* === Novel Tab Styles === */
.novel-tab-content {
  padding: 20px !important;
  background: linear-gradient(135deg, #fef7ed 0%, #fdf4e8 50%, #fef9f3 100%) !important;
  gap: 20px;
  min-height: 100%;
}

.novel-status-card {
  background: linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(180, 83, 9, 0.25), 0 4px 12px rgba(0, 0, 0, 0.1);
  border: none;
  color: white;
  position: relative;
  overflow: hidden;
}

.novel-status-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  pointer-events: none;
}

.novel-hero {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.novel-hero-icon {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.novel-hero-content {
  flex: 1;
}

.novel-hero-title {
  margin: 0 0 4px 0;
  font-size: 22px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.5px;
}

.novel-hero-desc {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.novel-status-tags {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: stretch;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  font-size: 14px;
  border-radius: 12px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  min-width: 120px;
}

.status-tag:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
}

.status-tag-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.status-tag-pending .status-tag-icon {
  background: rgba(251, 191, 36, 0.3);
  color: #fef3c7;
}

.status-tag-success .status-tag-icon {
  background: rgba(34, 197, 94, 0.3);
  color: #bbf7d0;
}

.status-tag-running .status-tag-icon {
  background: rgba(59, 130, 246, 0.3);
  color: #bfdbfe;
}

.status-tag-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tag-value {
  font-weight: 700;
  font-size: 18px;
  color: white;
}

.novel-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
  border: 1px solid #f3e8d8;
  margin-bottom: 20px;
  transition: all 0.3s ease;
}

.novel-section:hover {
  box-shadow: 0 4px 16px rgba(180, 83, 9, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06);
  border-color: #e8d5c4;
}

.novel-section-step1 {
  border-left: 4px solid #f59e0b;
}

.novel-section-step2 {
  border-left: 4px solid #d97706;
}

.novel-section-step3 {
  border-left: 4px solid #b45309;
}

.novel-section.export-section {
  background: linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%);
  color: white;
  border: none;
  border-left: none;
  box-shadow: 0 8px 32px rgba(180, 83, 9, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15);
}

.export-section:hover {
  box-shadow: 0 12px 40px rgba(180, 83, 9, 0.35), 0 6px 16px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.export-section .novel-section-header .section-title,
.export-section .novel-section-header .section-subtitle,
.export-section .form-label {
  color: white !important;
}

.novel-section-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #fef3c7;
}

.export-section .novel-section-header {
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.section-step-badge {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
  flex-shrink: 0;
}

.section-step-badge-light {
  background: rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.section-header-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: #78350f;
  letter-spacing: -0.3px;
}

.section-subtitle {
  font-size: 13px;
  color: #a16207;
  font-weight: 500;
}

.novel-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row > .form-group {
  flex: 1;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.input-with-button .novel-input {
  flex: 1;
}

.novel-input,
.novel-select,
.novel-textarea {
  border-radius: 8px;
  transition: all 0.3s;
}

.novel-input:focus,
.novel-select:focus,
.novel-textarea:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.filter-label {
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
}

.action-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.primary-action-btn {
  font-weight: 600;
  height: 44px;
  padding: 0 28px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
  transition: all 0.3s;
}

.primary-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
}

.result-tag {
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
  color: #92400e !important;
  border: 1px solid #fcd34d !important;
}

.chapters-list {
  margin-top: 16px;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.list-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.list-info {
  font-size: 12px;
  color: #9ca3af;
}

.novel-chapters-list {
  max-height: 400px;
  overflow-y: auto;
  border-radius: 8px;
}

.chapter-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px !important;
  transition: background 0.2s;
}

.chapter-item:hover {
  background: #f9fafb;
}

.chapter-index {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  font-weight: 700;
  font-size: 13px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.35);
}

.chapter-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chapter-title {
  font-weight: 600;
  color: #1f2937;
  font-size: 14px;
}

.chapter-url {
  color: #9ca3af;
  font-size: 12px;
  word-break: break-all;
  font-family: 'Consolas', monospace;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.option-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.option-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.option-desc {
  font-size: 12px;
  color: #6b7280;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.param-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.param-hint {
  font-size: 11px;
  color: #9ca3af;
}

.json-fields-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.export-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 8px;
}

.export-btn {
  height: 48px;
  font-weight: 600;
  font-size: 15px;
  border-radius: 8px;
  transition: all 0.3s;
}

.export-btn:hover {
  transform: translateY(-2px);
}

.export-txt {
  background: white;
  color: #92400e;
  border: 2px solid white;
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
}

.export-txt:hover {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 20px rgba(255, 255, 255, 0.45);
  color: #78350f;
}

.export-json {
  background: rgba(255, 255, 255, 0.18);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.35);
}

.export-json:hover {
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.55);
}

.novel-logs-collapse {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.logs-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.failures-section,
.logs-section {
  margin-bottom: 16px;
}

.subsection-title {
  font-size: 13px;
  font-weight: 600;
  color: #78350f;
  margin-bottom: 10px;
  padding: 8px 14px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 8px;
  border-left: 3px solid #f59e0b;
}

.failures-list {
  max-height: 300px;
  overflow-y: auto;
  border-radius: 8px;
}

.failure-item {
  padding: 12px !important;
}

.failure-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.failure-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #374151;
}

.failure-time {
  color: #6b7280;
  font-size: 12px;
}

.failure-error {
  color: #ef4444;
  font-size: 13px;
}

.failure-url {
  color: #9ca3af;
  font-size: 12px;
  word-break: break-all;
  font-family: 'Consolas', monospace;
  padding-left: 24px;
}

.logs-textarea {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.logs-textarea::placeholder {
  color: #64748b;
}

</style>
