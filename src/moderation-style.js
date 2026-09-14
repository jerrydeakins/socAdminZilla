const STYLE_ID = "socadmin-moderation-style";

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
/* Moderation selection UI */
#sa-mod .sa-mod-selection-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  box-sizing: border-box;
  margin: 0 0 10px;
  padding: 8px 10px;
  border: 1px solid rgba(0,0,0,.10);
  border-radius: 9px;
  background: rgba(250,250,250,.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 4px 14px rgba(0,0,0,.10);
}

#sa-mod .sa-mod-selection-toolbar > label {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

#sa-mod .sa-mod-selection-toolbar > label input,
#sa-mod .sa-mod-group-select input,
#sa-mod .sa-mod-post-select input {
  appearance: none;
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  margin: 0;
  flex: 0 0 22px;
  box-sizing: border-box;
  border: 2px solid #aeb4bd;
  border-radius: 5px;
  background: rgba(255,255,255,.95);
  cursor: pointer;
  transition: border-color .12s ease, background .12s ease, box-shadow .12s ease, transform .08s ease;
}

#sa-mod .sa-mod-selection-toolbar > label input:hover,
#sa-mod .sa-mod-group-select input:hover,
#sa-mod .sa-mod-post-select input:hover {
  border-color: #3b82f6;
}

#sa-mod .sa-mod-selection-toolbar > label input:checked,
#sa-mod .sa-mod-group-select input:checked,
#sa-mod .sa-mod-post-select input:checked {
  border-color: #3b82f6;
  background: #3b82f6;
  box-shadow: 0 1px 4px rgba(59,130,246,.28);
}

#sa-mod .sa-mod-selection-toolbar > label input:checked::after,
#sa-mod .sa-mod-group-select input:checked::after,
#sa-mod .sa-mod-post-select input:checked::after {
  content: "";
  display: block;
  width: 10px;
  height: 6px;
  margin: 5px 0 0 4px;
  border-left: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: rotate(-45deg);
}

#sa-mod .sa-mod-selection-toolbar > label input:indeterminate,
#sa-mod .sa-mod-group-select input:indeterminate {
  border-color: #3b82f6;
  background: #3b82f6;
}

#sa-mod .sa-mod-selection-toolbar > label input:indeterminate::after,
#sa-mod .sa-mod-group-select input:indeterminate::after {
  content: "";
  display: block;
  width: 10px;
  height: 2px;
  margin: 8px 0 0 4px;
  background: #fff;
  border-radius: 2px;
}

#sa-mod .sa-mod-selection-toolbar [data-mod-selection-count] {
  color: #737985;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

#sa-mod .sa-mod-selection-toolbar [data-mod-clear-selection],
#sa-mod .sa-mod-selection-toolbar [data-mod-delete-selected] {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition: background .12s ease, border-color .12s ease, color .12s ease, opacity .12s ease, transform .08s ease;
}

#sa-mod .sa-mod-selection-toolbar [data-mod-clear-selection] {
  background: rgba(255,255,255,.70);
}

#sa-mod .sa-mod-selection-toolbar [data-mod-delete-selected] {
  margin-left: auto;
  border-color: #ef4444;
  color: #fff;
  background: #ef4444;
}

#sa-mod .sa-mod-selection-toolbar [data-mod-delete-selected]:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}

#sa-mod .sa-mod-selection-toolbar [data-mod-delete-selected]:disabled {
  opacity: .45;
  cursor: default;
}

/* Empty state: only the select-all control remains visible until selection exists. */
#sa-mod:not(:has([data-mod-post-select]:checked)) .sa-mod-selection-toolbar [data-mod-clear-selection],
#sa-mod:not(:has([data-mod-post-select]:checked)) .sa-mod-selection-toolbar [data-mod-selection-count],
#sa-mod:not(:has([data-mod-post-select]:checked)) .sa-mod-selection-toolbar [data-mod-delete-selected] {
  display: none;
}

/* Once something is selected, turn the toolbar into a compact contextual action bar. */
#sa-mod:has([data-mod-post-select]:checked) .sa-mod-selection-toolbar > label {
  font-size: 0;
}

#sa-mod:has([data-mod-post-select]:checked) .sa-mod-selection-toolbar > label::after {
  content: "";
}

#sa-mod:has([data-mod-post-select]:checked) .sa-mod-selection-toolbar > label input {
  margin-right: 2px;
}

#sa-mod .sa-mod-group {
  margin-bottom: 10px;
}

#sa-mod .sa-mod-group-head {
  min-height: 64px;
  padding: 7px 10px;
  border-radius: 9px;
  background: rgba(255,255,255,.34);
  transition: border-color .12s ease, background .12s ease;
}

#sa-mod .sa-mod-group-logo,
#sa-mod .sa-mod-group-logo-placeholder {
  width: 48px;
  height: 48px;
  flex-basis: 48px;
}

#sa-mod .sa-mod-group-select {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding-left: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

#sa-mod .sa-mod-group-posts {
  gap: 6px;
  padding-left: 0;
}

#sa-mod .sa-mod-group-posts .sa-card {
  position: relative;
  padding: 16px;
  border-radius: 9px;
  background: rgba(255,255,255,.34);
  border-color: rgba(0,0,0,.10);
  transition: border-color .12s ease, background .12s ease, box-shadow .12s ease, transform .08s ease;
}

#sa-mod .sa-mod-group-posts .sa-card:hover {
  border-color: rgba(59,130,246,.45);
  background: rgba(255,255,255,.46);
}

#sa-mod .sa-mod-post-select {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 3;
  display: block;
  width: 22px;
  height: 22px;
  margin: 0;
  font-size: 0;
  line-height: 0;
}

#sa-mod .sa-mod-post-select input {
  display: block;
}

#sa-mod .sa-mod-group-posts .sa-card:has([data-mod-post-select]:checked) {
  border-color: #3b82f6;
  background: rgba(59,130,246,.08);
  box-shadow: 0 0 0 1px rgba(59,130,246,.18);
}

#sa-mod .sa-mod-group-posts .sa-card:has([data-mod-post-select]:checked):hover {
  background: rgba(59,130,246,.11);
}

@media(max-width:650px) {
  #sa-mod .sa-mod-selection-toolbar {
    flex-wrap: wrap;
    gap: 7px;
  }
  #sa-mod .sa-mod-selection-toolbar [data-mod-delete-selected] {
    margin-left: 0;
  }
}

@media(prefers-color-scheme:dark) {
  #sa-mod .sa-mod-selection-toolbar {
    border-color: rgba(255,255,255,.12);
    background: rgba(30,31,36,.86);
    box-shadow: 0 5px 18px rgba(0,0,0,.32);
  }

  #sa-mod .sa-mod-selection-toolbar > label {
    color: #e5e7eb;
  }

  #sa-mod .sa-mod-selection-toolbar > label input,
  #sa-mod .sa-mod-group-select input,
  #sa-mod .sa-mod-post-select input {
    border-color: #9ca3af;
    background: #1e1e2c;
  }

  #sa-mod .sa-mod-selection-toolbar [data-mod-selection-count] {
    color: #9ca3af;
  }

  #sa-mod .sa-mod-selection-toolbar [data-mod-clear-selection] {
    color: #e5e7eb;
    background: rgba(45,45,63,.75);
    border-color: #6b7280;
  }

  #sa-mod .sa-mod-group-head {
    border-color: rgba(255,255,255,.10);
    background: rgba(45,45,63,.62);
  }

  #sa-mod .sa-mod-group-posts .sa-card {
    border-color: rgba(255,255,255,.08);
    background: #2d2d3f;
  }

  #sa-mod .sa-mod-group-posts .sa-card:hover {
    border-color: rgba(59,130,246,.65);
    background: #303044;
  }

  #sa-mod .sa-mod-group-posts .sa-card:has([data-mod-post-select]:checked) {
    border-color: #3b82f6;
    background: #2d3447;
    box-shadow: 0 0 0 1px rgba(59,130,246,.35);
  }
}
`;
  document.documentElement.appendChild(style);
}
