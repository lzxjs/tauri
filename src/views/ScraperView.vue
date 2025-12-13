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
        <a-tooltip title="粘贴网址">
          <a-button type="text" class="icon-btn" @click="pasteUrl">
            <CopyOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="清空输入">
          <a-button
            type="text"
            class="icon-btn"
            @click="clearTargetUrl"
            :disabled="!targetUrl"
          >
            <ClearOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="在浏览器打开">
          <a-button
            type="text"
            class="icon-btn"
            @click="openInBrowser"
            :disabled="!targetUrl"
          >
            <GlobalOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="请求设置">
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
        <a-tooltip title="生成代码">
          <a-button type="text" class="icon-btn" @click="showCodeModal">
            <CodeOutlined />
          </a-button>
        </a-tooltip>

        <a-dropdown :trigger="['click']">
          <a-tooltip title="规则管理">
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
                <span v-if="targetUrl">{{ targetUrl }}</span>
                <span v-else style="color: #9ca3af; font-style: italic">about:blank</span>
              </div>
              <ReloadOutlined class="browser-reload-icon" @click="fetchPage" />
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
              <span class="tab-label"> 小说 </span>
            </template>

            <div class="config-content task-tab-content">
              <div class="task-section">
                <a-alert
                  type="info"
                  show-icon
                  message="小说爬虫：目录解析 -> 导出"
                  description="这个页面专注抓小说：解析目录后直接导出（title/content/url），由后端抓取生成文件，速度快且不卡顿。"
                />
                <div class="task-actions-row" style="margin-top: 10px">
                  <a-tag color="blue"
                    >待抓取: {{ novelCrawlQueueRemaining }}</a-tag
                  >
                  <a-tag color="green"
                    >已抓取: {{ novelCrawlResultsCount }}</a-tag
                  >
                  <a-tag v-if="novelCrawlRunning" color="gold">运行中</a-tag>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">目录解析（小说章节）</div>
                <div style="display: flex; flex-direction: column; gap: 10px">
                  <div style="display: flex; gap: 8px; align-items: center">
                    <a-input
                      v-model:value="directoryUrl"
                      placeholder="目录页 URL (https://...)"
                    />
                    <a-button
                      size="small"
                      @click="directoryUrl = targetUrl"
                      :disabled="!targetUrl"
                    >
                      使用当前 URL
                    </a-button>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center">
                    <a-input
                      v-model:value="novelLinkSelector"
                      placeholder="章节链接选择器 (例如 .chapter-list a)"
                    />
                    <a-select
                      v-model:value="novelLinkAttr"
                      style="width: 140px"
                    >
                      <a-select-option value="href">href</a-select-option>
                      <a-select-option value="data-href"
                        >data-href</a-select-option
                      >
                      <a-select-option value="text">text</a-select-option>
                    </a-select>
                    <a-input-number
                      v-model:value="novelMaxItems"
                      :min="1"
                      :max="5000"
                      style="width: 140px"
                    />
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center">
                    <a-switch v-model:checked="novelSameDomainOnly" />
                    <span style="color: #64748b">仅同域</span>
                    <a-input
                      v-model:value="novelIncludePattern"
                      placeholder="包含正则(可选)"
                    />
                    <a-input
                      v-model:value="novelExcludePattern"
                      placeholder="排除正则(可选)"
                    />
                  </div>

                  <div style="display: flex; gap: 8px">
                    <a-button
                      type="primary"
                      :loading="novelParsing"
                      :disabled="!novelCanParse"
                      @click="parseNovelDirectory"
                    >
                      解析目录
                    </a-button>
                    <a-tag color="blue">{{ novelChapters.length }} 条</a-tag>
                  </div>

                  <div
                    v-if="novelParseError"
                    style="color: #ef4444; white-space: pre-wrap"
                  >
                    {{ novelParseError }}
                  </div>
                  <a-list
                    size="small"
                    bordered
                    :data-source="novelChapters.slice(0, 50)"
                    :locale="{ emptyText: '暂无解析结果（最多展示前 50 条）' }"
                  >
                    <template #renderItem="{ item }">
                      <a-list-item>
                        <div
                          style="
                            display: flex;
                            flex-direction: column;
                            gap: 2px;
                            width: 100%;
                          "
                        >
                          <div style="font-weight: 600">
                            {{ item.title || "—" }}
                          </div>
                          <div
                            style="
                              color: #64748b;
                              font-size: 12px;
                              word-break: break-all;
                            "
                          >
                            {{ item.url }}
                          </div>
                        </div>
                      </a-list-item>
                    </template>
                  </a-list>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">抓取规则（章节页）</div>
                <div style="display: flex; flex-direction: column; gap: 10px">
                  <div style="display: flex; gap: 8px; align-items: center">
                    <div style="width: 110px; color: #64748b">标题选择器</div>
                    <a-input
                      v-model:value="novelTitleSelector"
                      placeholder="例如 h1"
                    />
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center">
                    <div style="width: 110px; color: #64748b">正文选择器</div>
                    <a-input
                      v-model:value="novelContentSelector"
                      placeholder="例如 #content"
                    />
                  </div>

                  <div
                    style="
                      display: flex;
                      gap: 12px;
                      align-items: center;
                      flex-wrap: wrap;
                    "
                  >
                    <a-switch v-model:checked="novelExportIncludeUrlLine" />
                    <span style="color: #64748b">导出附带 URL</span>
                  </div>

                  <div
                    style="
                      display: flex;
                      gap: 12px;
                      align-items: center;
                      flex-wrap: wrap;
                    "
                  >
                    <a-switch v-model:checked="novelCleanEnabled" />
                    <span style="color: #64748b">启用自定义清洗正则</span>
                  </div>

                  <a-textarea
                    v-model:value="novelCleanRegexText"
                    :disabled="!novelCleanEnabled"
                    placeholder="每行一个正则（匹配到的内容会被删除），例如：\napp2\\(\\);\nread2\\(\\);\nchaptererror\\(\\);"
                    :auto-size="{ minRows: 3, maxRows: 8 }"
                  />
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">执行</div>
                <div style="display: flex; flex-direction: column; gap: 10px">
                  <div class="task-grid">
                    <div class="task-grid-item">
                      <div class="task-label">并发</div>
                      <a-input-number
                        v-model:value="novelCrawlConcurrency"
                        :min="1"
                        :max="8"
                        style="width: 100%"
                      />
                    </div>
                    <div class="task-grid-item">
                      <div class="task-label">间隔(ms)</div>
                      <a-input-number
                        v-model:value="novelCrawlDelayMs"
                        :min="0"
                        :max="30000"
                        style="width: 100%"
                      />
                    </div>
                    <div class="task-grid-item">
                      <div class="task-label">重试</div>
                      <a-input-number
                        v-model:value="novelCrawlRetry"
                        :min="0"
                        :max="10"
                        style="width: 100%"
                      />
                    </div>
                    <div class="task-grid-item">
                      <div class="task-label">最大章节</div>
                      <a-input-number
                        v-model:value="novelCrawlMaxPages"
                        :min="1"
                        :max="20000"
                        style="width: 100%"
                      />
                    </div>
                  </div>

                  <div class="task-actions-row">
                    <a-button
                      danger
                      :disabled="!novelCrawlRunning"
                      @click="cancelNovelExport"
                    >
                      <StopOutlined /> 停止
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

              <div class="task-section">
                <div class="task-section-title">导出</div>
                <div style="display: flex; flex-direction: column; gap: 10px">
                  <div
                    style="
                      display: flex;
                      gap: 8px;
                      align-items: center;
                      flex-wrap: wrap;
                    "
                  >
                    <div style="width: 120px; color: #64748b">JSON 字段名</div>
                    <a-input
                      v-model:value="novelJsonKeyTitle"
                      style="width: 140px"
                      placeholder="title 字段"
                    />
                    <a-input
                      v-model:value="novelJsonKeyContent"
                      style="width: 140px"
                      placeholder="content 字段"
                    />
                    <a-input
                      v-model:value="novelJsonKeyUrl"
                      style="width: 140px"
                      placeholder="url 字段"
                    />
                  </div>
                  <div style="display: flex; gap: 8px">
                    <a-button
                      type="primary"
                      :disabled="
                        novelChapters.length === 0 || novelCrawlRunning
                      "
                      @click="exportNovelCrawlerTxt"
                    >
                      导出 TXT
                    </a-button>
                    <a-button
                      :disabled="
                        novelChapters.length === 0 || novelCrawlRunning
                      "
                      @click="exportNovelCrawlerJson"
                    >
                      导出 JSON
                    </a-button>
                    <a-tag color="blue"
                      >已抓取章节: {{ novelCrawlResultsCount }}</a-tag
                    >
                  </div>
                </div>
              </div>

              <div class="task-section">
                <div class="task-section-title">失败与日志</div>
                <div class="task-actions-row" style="margin-bottom: 10px">
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
                    <DownloadOutlined /> 导出失败
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
                  <a-tag v-if="novelCrawlFailures.length" color="red"
                    >失败: {{ novelCrawlFailures.length }}</a-tag
                  >
                </div>

                <div
                  v-if="novelCrawlFailures.length"
                  style="margin-bottom: 10px"
                >
                  <a-list
                    size="small"
                    bordered
                    :data-source="novelCrawlFailures.slice(0, 20)"
                    :locale="{ emptyText: '暂无失败记录' }"
                  >
                    <template #renderItem="{ item }">
                      <a-list-item>
                        <div
                          style="
                            display: flex;
                            flex-direction: column;
                            gap: 2px;
                            width: 100%;
                          "
                        >
                          <div style="font-weight: 600">
                            {{ item.time }} - {{ item.error }}
                          </div>
                          <div
                            style="
                              color: #64748b;
                              font-size: 12px;
                              word-break: break-all;
                            "
                          >
                            {{ item.url }}
                          </div>
                        </div>
                      </a-list-item>
                    </template>
                  </a-list>
                </div>

                <a-textarea
                  :value="novelCrawlLogsText"
                  readonly
                  :auto-size="{ minRows: 6, maxRows: 12 }"
                />
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
          <li>
            在「任务执行」里批量抓取并导出 JSON/CSV 或「生成代码」导出脚本
          </li>
        </ol>

        <h3>顶部按钮</h3>
        <ul>
          <li>
            <b>加载页面</b>：请求网页并在左侧 iframe 展示，同时更新预览解析源
            HTML。
          </li>
          <li>
            <b>请求设置</b>：配置
            Headers、超时、代理、证书策略，影响加载与任务执行。
          </li>
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
          <li>
            <b>列表模式</b>：通过 listSelector 找到列表项，对每个 item
            提取字段。
          </li>
        </ul>

        <h3>任务执行</h3>
        <ul>
          <li><b>起始 URL</b>：每行一个 URL，可导入队列。</li>
          <li><b>并发/间隔/重试</b>：控制抓取速度与稳定性。</li>
          <li><b>链接发现</b>：从页面中按选择器提取链接并加入队列。</li>
          <li><b>下一页</b>：按选择器提取下一页链接并加入队列。</li>
          <li><b>暂停/继续</b>：临时暂停请求，继续后恢复。</li>
          <li><b>更多设置</b>：结果去重、启动前清空结果/日志/失败等。</li>
          <li>
            <b>任务面板</b>：查看正在抓取、待抓取队列、失败记录与运行日志。
          </li>
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
  previewResult,
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
  return !loading.value && !!(targetUrl.value || "").trim();
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

const exportNovelCrawlerTxt = async () => {
  try {
    await ensureNovelCrawlListeners();
    const urls = (Array.isArray(novelChapters.value) ? novelChapters.value : [])
      .map((x) => x?.url)
      .filter(Boolean)
      .map((u) => normalizedUrl(u))
      .filter(Boolean);
    if (!urls.length) {
      message.warning("没有可导出的章节链接（请先解析目录）");
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
    pushNovelCrawlLog("开始后端导出 TXT");

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
    const urls = (Array.isArray(novelChapters.value) ? novelChapters.value : [])
      .map((x) => x?.url)
      .filter(Boolean)
      .map((u) => normalizedUrl(u))
      .filter(Boolean);
    if (!urls.length) {
      message.warning("没有可导出的章节链接（请先解析目录）");
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
    pushNovelCrawlLog("开始后端导出 JSON");

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
    if (!text) return;
    targetUrl.value = text.trim();
  } catch (e) {
    message.error("粘贴失败（可能无权限）");
  }
};

const clearTargetUrl = () => {
  targetUrl.value = "";
};

const openInBrowser = () => {
  const u = normalizedUrl(targetUrl.value);
  if (!u) return;
  window.open(u, "_blank");
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
    if (typeof err === "string") return err;
    if (err instanceof Error) {
      const parts = [];
      if (err.name) parts.push(err.name);
      if (err.message) parts.push(err.message);
      const causeMsg =
        typeof err.cause === "string"
          ? err.cause
          : err.cause && typeof err.cause === "object" && "message" in err.cause
          ? err.cause.message
          : "";
      if (causeMsg) parts.push(`cause: ${causeMsg}`);
      return parts.join(" | ") || "网络请求失败";
    }
    if (typeof err === "object") {
      const msg = err.message || err.toString?.();
      return msg || "网络请求失败";
    }
    return String(err);
  } catch (_) {
    return "网络请求失败";
  }
};

const fetchPage = async () => {
  if (!targetUrl.value) {
    message.warning("请输入目标网址");
    return;
  }

  targetUrl.value = normalizedUrl(targetUrl.value);

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

  if (key === "escape") {
    isInspectorActive.value = false;
    if (codeModalVisible.value) codeModalVisible.value = false;
    if (settingsVisible.value) settingsVisible.value = false;
  }

  if (!mod) return;

  if (key === "enter" && !e.isComposing) {
    // Only fetch if focused on URL? Actually let's restrict this
    // e.preventDefault();
    // fetchPage();
  } else if (key === "l") {
    e.preventDefault();
    urlInputRef.value?.focus?.();
  } else if (key === "i") {
    e.preventDefault();
    isInspectorActive.value = !isInspectorActive.value;
  }
};

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
  fields.push({
    name: `field_${fields.length + 1}`,
    selector: "",
    attr: "text",
    customAttr: "",
    transformType: "none",
    transformPattern: "",
    transformReplacement: "",
  });
  currentFieldIndex.value = fields.length - 1;
};

const removeField = (index) => {
  fields.splice(index, 1);
  if (currentFieldIndex.value >= fields.length) {
    currentFieldIndex.value = Math.max(0, fields.length - 1);
  } else if (index < currentFieldIndex.value) {
    currentFieldIndex.value--;
  }
};

const moveField = (index, direction) => {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= fields.length) return;
  const temp = fields[index];
  fields[index] = fields[newIndex];
  fields[newIndex] = temp;
  if (currentFieldIndex.value === index) {
    currentFieldIndex.value = newIndex;
  } else if (currentFieldIndex.value === newIndex) {
    currentFieldIndex.value = index;
  }
};

const duplicateField = (index) => {
  if (index < 0 || index >= fields.length) return;
  const field = fields[index];
  fields.splice(index + 1, 0, JSON.parse(JSON.stringify(field)));
};

const copyFieldSelector = async (index) => {
  const text =
    fields[index] && fields[index].selector
      ? String(fields[index].selector)
      : "";
  if (!text) {
    message.info("暂无可复制的选择器");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    message.success("选择器已复制");
  } catch (e) {
    message.error("复制失败");
  }
};

const clearFieldSelector = (index) => {
  if (fields[index]) fields[index].selector = "";
};

const tableColumns = computed(() => {
  return fields
    .filter((f) => f && f.name)
    .map((f) => ({ title: f.name, dataIndex: f.name, key: f.name }));
});

const highlightFieldSelector = (index) => {
  if (!fields[index]) return;
  highlightSelectorInPreview(fields[index].selector);
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
  padding: 16px;
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
</style>
