import { User } from "lucide-react";
import type React from "react";

interface ProfilePagePopupProps {
  userId: string;
}

export const ProfilePagePopup: React.FC<ProfilePagePopupProps> = ({
  userId,
}) => {
  return (
    <div className="profile-popup">
      <div className="header">
        <h3>个人主页</h3>
      </div>

      <div className="placeholder">
        <div className="placeholder-icon">
          <User size={48} color="#666" />
        </div>
        <div className="placeholder-text">
          <p>个人主页功能开发中...</p>
          <p className="user-id">用户ID: {userId}</p>
        </div>
      </div>

      <div className="coming-soon">
        <h4>即将推出的功能:</h4>
        <ul>
          <li>批量下载用户作品</li>
          <li>导出用户信息</li>
          <li>关注/粉丝数据分析</li>
        </ul>
      </div>
    </div>
  );
};
