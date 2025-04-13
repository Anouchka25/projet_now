import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Onfido from 'onfido-sdk-ui';

const VerifyIdentity = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const startOnfido = async () => {
      const res = await fetch('/api/create-onfido-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Anouchka',
          lastName: 'Minkoue Obame'
        })
      });
      const { sdkToken } = await res.json();

      Onfido.init({
        token: sdkToken,
        containerId: 'onfido-mount',
        steps: ['document', 'face'],
        onComplete: () => navigate('/transfer')
      });
    };

    startOnfido();
  }, []);

  return <div id="onfido-mount" className="w-full h-screen p-4"></div>;
};

export default VerifyIdentity;
