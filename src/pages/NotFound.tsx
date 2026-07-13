import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Result, Button } from 'antd';
import { Home } from 'lucide-react';
import { useTheme } from 'antd-style';
import { pageVariants } from '@renderer/lib/motion';

function NotFoundComp(): React.ReactElement {
  const navigate = useNavigate();
  const theme = useTheme();

  const handleGoHome = (): void => {
    navigate('/');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.colorBgLayout,
      }}
    >
      <motion.div variants={pageVariants} initial="hidden" animate="visible">
        <Result
          status="404"
          title="404"
          subTitle="页面不存在"
          extra={
            <Button
              type="primary"
              icon={<Home size={16} />}
              onClick={handleGoHome}
            >
              返回首页
            </Button>
          }
        />
      </motion.div>
    </div>
  );
}

export const NotFound = NotFoundComp;