import styled from 'styled-components';
import { theme } from './utils/colors';

export const Container = styled.div`
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center;
  min-height: 100vh; 
  background-color: ${theme.background}; 
  color: ${theme.text}; 
  font-family: sans-serif; 
  padding: 2rem;
`;

export const Title = styled.h1`
  font-size: 3rem; 
  color: ${theme.primary}; 
  margin-bottom: 1rem;
`;

export const VideoWrapper = styled.div`
  position: relative; 
  width: 640px; 
  height: 480px;
  background-color: black;
  border-radius: 12px; 
  overflow: hidden; 
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); 
  margin-bottom: 2rem;
  video, canvas { 
    position: absolute; 
    top: 0; 
    left: 0; 
    width: 100%; 
    height: 100%; 
  }
  video {
    transform: scaleX(-1); 
  }
  canvas { z-index: 10; }
`;

export const ControlsPanel = styled.div`
  display: flex; 
  gap: 1rem; 
  align-items: center; 
  background: ${theme.surface}; 
  padding: 1.5rem;
  border-radius: 12px; 
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
  flex-wrap: wrap; 
  justify-content: center;
`;

export const Select = styled.select`
  padding: 0.8rem; 
  font-size: 1.1rem; 
  border-radius: 8px; 
  background: ${theme.surface}; 
  color: ${theme.text};
  border: 2px solid ${theme.primary}; 
  outline: none; 
  cursor: pointer;
`;

export const Button = styled.button<{ $variant?: 'record' | 'export' | 'clear' | 'train' | 'idle', $isActive?: boolean }>`
  background-color: ${(props) => {
    switch (props.$variant) {
      case 'record': return props.$isActive ? theme.secondary : theme.primary;
      case 'export': return theme.warning;
      case 'clear': return theme.neutral;
      case 'train': return theme.success;
      case 'idle': return props.$isActive ? theme.secondary : theme.neutral;
      default: return theme.primary;
    }
  }};
  color: white; 
  font-size: 1.1rem; 
  font-weight: bold; 
  padding: 0.8rem 1.5rem; 
  border: none;
  border-radius: 8px; 
  cursor: pointer; 
  transition: all 0.2s ease;
  &:disabled { 
    background-color: ${theme.disabled}; 
    cursor: not-allowed; 
    opacity: 0.7; 
  }
  &:hover:not(:disabled) { 
    transform: translateY(-2px); 
    filter: brightness(1.1); 
  }
`;

export const BadgeContainer = styled.div`
  display: flex; 
  gap: 10px; 
  flex-wrap: wrap; 
  justify-content: center; 
  margin-top: 20px; 
  max-width: 800px;
`;

export const Badge = styled.div<{ $type: 'static' | 'dynamic' }>`
  background: ${props => props.$type === 'static' ? theme.primary : theme.secondary};
  color: white; 
  padding: 8px 15px; 
  border-radius: 5px; 
  font-size: 1rem; 
  font-weight: bold; 
  display: flex; 
  align-items: center; gap: 10px;
`;

export const DeleteBtn = styled.button`
  background: ${theme.badgeControlBg}; 
  border: none; 
  border-radius: 50%; 
  width: 24px; 
  height: 24px; 
  cursor: pointer; 
  color: white;
  &:hover { background: ${theme.deleteHighlight}; }
`;

export const PredictionsOverlay = styled.div`
  position: absolute; 
  bottom: 20px; 
  left: 0; 
  width: 100%; 
  display: flex; 
  justify-content: center; 
  z-index: 20; 
  pointer-events: none; 
  gap: 10px;
`;

export const PredictionBadge = styled.div`
  background: rgba(0,0,0,0.8); 
  color: white; 
  padding: 10px 20px; 
  border-radius: 8px; 
  font-size: 1.5rem; 
  font-weight: bold;
`;