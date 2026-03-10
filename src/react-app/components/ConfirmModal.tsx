import Button from './Button';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info' | 'success';
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    onConfirm,
    onCancel,
    variant = 'danger'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (variant) {
            case 'danger':
                return <AlertTriangle className="h-6 w-6 text-red-600" />;
            case 'warning':
                return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
            case 'success':
                return <CheckCircle className="h-6 w-6 text-green-600" />;
            case 'info':
            default:
                return <Info className="h-6 w-6 text-blue-600" />;
        }
    };

    const getBgColor = () => {
        switch (variant) {
            case 'danger':
                return 'bg-red-100';
            case 'warning':
                return 'bg-yellow-100';
            case 'success':
                return 'bg-green-100';
            case 'info':
            default:
                return 'bg-blue-100';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl transform transition-all">
                <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-2 rounded-lg ${getBgColor()}`}>
                        {getIcon()}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    </div>
                </div>

                <p className="text-gray-600 mb-8 leading-relaxed">
                    {message}
                </p>

                <div className="flex justify-end space-x-3">
                    <Button
                        variant="secondary"
                        onClick={onCancel}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
