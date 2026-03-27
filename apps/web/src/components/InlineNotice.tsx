type InlineNoticeProps = {
  tone: "error" | "success";
  message: string;
};

export function InlineNotice({ tone, message }: InlineNoticeProps) {
  return <div className={`notice notice--${tone}`}>{message}</div>;
}
