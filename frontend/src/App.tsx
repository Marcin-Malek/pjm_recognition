
import { BrowserRouter, Route, Routes } from 'react-router';
import Predictor from './Predictor';
import TrainingSuite from './TrainingSuite';

const App = () => {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/" element={<Predictor />} />
          <Route path="/train" element={<TrainingSuite />} />
        </Routes>
    </BrowserRouter>
  );
};

export default App;