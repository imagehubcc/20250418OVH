
import React from 'react';
import { Link } from 'react-router-dom';
import AddTaskForm from '@/components/queue/AddTaskForm';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NewTaskPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center mb-4">
          <Link to="/queue">
            <Button variant="outline" size="sm" className="mr-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">创建抢购任务</h1>
        </div>
        <p className="text-muted-foreground">配置服务器抢购任务参数</p>
      </div>
      
      <AddTaskForm />
    </div>
  );
};

export default NewTaskPage;
