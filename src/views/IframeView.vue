<template>
  <div class="iframe-container">
    <iframe
      src="https://fqyyds.com"
      class="iframe-content"
      frameborder="0"
      allowfullscreen
    ></iframe>
  </div>
</template>

<script setup>
</script>

<style scoped>
.iframe-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: var(--box-shadow);
}

.iframe-content {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
