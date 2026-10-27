import React, { useState, useCallback } from 'react';
import { Button, Row, Col, Card, Spin, message, Progress, Modal } from 'antd';
import { UploadOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';

interface CoverPreview {
  style: string;
  url: string;
}

interface CoverPreviewsResponse {
  success: boolean;
  previews?: CoverPreview[];
  error?: string;
  message: string;
}

const CoverPreviewGenerator: React.FC = () => {
  const [previews, setPreviews] = useState<CoverPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [videoPath, setVideoPath] = useState<string>('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<{url: string; style: string} | null>(null);

  const styleLabels: Record<string, string> = {
    default: '默认封面',
    'blur-bg': '背景虚化',
    outline: '人物描边',
    gradient: '渐变背景',
    split: '斜切设计'
  };

  const handleSelectFile = useCallback(async () => {
    try {
      // 使用文件对话框选择视频文件
      const filePath = await window.$mapi.file.openFile({
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }
        ],
        properties: ['openFile']
      });

      if (!filePath) {
        return;
      }

      setVideoPath(filePath as string);
      setLoading(true);
      setPreviews([]);

      // 调用electron API生成预览
      const result: CoverPreviewsResponse = await window.$mapi.subtitleCover.generatePreviews({
        videoPath: filePath as string
      });

      if (result.success && result.previews) {
        setPreviews(result.previews);
        message.success('封面预览生成成功！');
      } else {
        message.error(result.error || '生成预览失败');
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      message.error('预览生成失败，请重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePreview = useCallback((preview: CoverPreview) => {
    setPreviewImage({
      url: preview.url,
      style: styleLabels[preview.style] || preview.style
    });
    setPreviewVisible(true);
  }, [styleLabels]);

  const handleClosePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewImage(null);
  }, []);

  const handleDownload = useCallback(async (style: string) => {
    try {
      // 这里可以调用下载API
      const preview = previews.find(p => p.style === style);
      if (preview) {
        // 创建下载链接
        const link = document.createElement('a');
        link.href = preview.url;
        link.download = `cover-${style}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('封面下载成功！');
      }
    } catch (error) {
      message.error('下载失败');
    }
  }, [previews]);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2>实时封面预览生成器</h2>
        <p style={{ color: '#666' }}>
          选择视频文件，系统将自动提取关键帧并生成5种不同样式的封面预览供您选择。
        </p>
      </div>

      {/* 选择文件区域 */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          icon={<UploadOutlined />}
          onClick={handleSelectFile}
          loading={loading}
          disabled={loading}
        >
          {loading ? '正在生成预览...' : '选择视频文件'}
        </Button>
        {videoPath && (
          <div style={{ marginTop: '8px', color: '#666' }}>
            已选择: {videoPath}
          </div>
        )}
        <div style={{ marginTop: '8px', color: '#999' }}>
          支持 MP4、MOV、AVI、MKV、WebM 等常见视频格式
        </div>
      </div>

      {/* 预览区域 */}
      {previews.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>封面预览效果</h3>
          <Row gutter={[16, 16]}>
            {previews.map((preview) => (
              <Col xs={24} sm={12} md={8} lg={6} key={preview.style}>
                <Card
                  hoverable
                  cover={
                    <div style={{ position: 'relative', paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
                      <img
                        alt={styleLabels[preview.style] || preview.style}
                        src={preview.url}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '8px 8px 0 0'
                        }}
                      />
                    </div>
                  }
                  actions={[
                    <EyeOutlined key="view" title="预览" />,
                    <DownloadOutlined
                      key="download"
                      title="下载"
                      onClick={() => handleDownload(preview.style)}
                    />
                  ]}
                >
                  <Card.Meta
                    title={styleLabels[preview.style] || preview.style}
                    description={`样式: ${preview.style}`}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Progress percent={50} status="active" showInfo={false} />
            <div style={{ marginTop: '8px', color: '#666' }}>
              正在提取视频帧并生成封面预览...
            </div>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h4>使用说明：</h4>
        <ul style={{ color: '#666', lineHeight: '1.6' }}>
          <li>1. 点击"选择视频文件"按钮上传您的视频</li>
          <li>2. 系统将自动提取视频第一帧作为封面基础</li>
          <li>3. 系统会并行生成5种不同样式的封面预览</li>
          <li>4. 预览完成后，您可以点击下载按钮保存心仪的封面</li>
          <li>5. 支持的样式包括：默认封面、背景虚化、人物描边、渐变背景、斜切设计</li>
        </ul>
      </div>
    </div>
  );
};

export default CoverPreviewGenerator;