export interface AgentClarificationOption {
  id: "change" | "asset" | "access";
  label: string;
  value: string;
}

export interface AgentClarification {
  prompt: string;
  options: AgentClarificationOption[];
}

function hasWriteIntent(question: string) {
  return /新增|添加|录入|创建|修改|更新|改成|改为|调整|保存|增加/.test(question);
}

function hasExplicitTarget(question: string) {
  return /变更管理|变更记录|资产管理|新增资产|修改资产|进出管理|进出记录|出入记录/.test(question);
}

function looksLikeAmbiguousAssetChange(question: string) {
  return /(服务器|物理机|设备|主机|IP|\d{1,3}(?:\.\d{1,3}){3})/.test(question) &&
    /(增加|更换|维修|安装|调整|接线|上架|下架|显卡|内存|硬盘|网卡)/.test(question);
}

export function buildAgentClarification(question: string): AgentClarification | null {
  const text = question.trim();
  if (!hasWriteIntent(text) || hasExplicitTarget(text) || !looksLikeAmbiguousAssetChange(text)) {
    return null;
  }

  return {
    prompt:
      "这个操作需要确认要写入哪个模块。我可以继续处理，但先请你选择目标，避免把变更误写成资产。",
    options: [
      {
        id: "change",
        label: "录入变更记录",
        value: `在变更管理里面录入：${text}`,
      },
      {
        id: "asset",
        label: "新增或修改资产",
        value: `在资产管理里面新增或修改资产：${text}`,
      },
      {
        id: "access",
        label: "录入进出记录",
        value: `在进出管理里面录入：${text}`,
      },
    ],
  };
}
