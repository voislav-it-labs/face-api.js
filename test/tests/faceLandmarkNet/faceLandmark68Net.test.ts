import * as tf from '@tensorflow/tfjs-core';

import { fetchImage, fetchJson, IDimensions, isTensor3D, NetInput, Point, TMediaElement, toNetInput } from '../../../src';
import { FaceLandmarks68 } from '../../../src/classes/FaceLandmarks68';
import { createFaceLandmarkNet } from '../../../src/faceLandmarkNet';
import { FaceLandmark68Net } from '../../../src/faceLandmarkNet/FaceLandmark68Net';
import { describeWithNets, expectAllTensorsReleased, expectMaxDelta, expectPointClose } from '../../utils';

function getInputDims (input: tf.Tensor | TMediaElement): IDimensions {
  if (input instanceof tf.Tensor) {
    const [height, width] = input.shape.slice(isTensor3D(input) ? 0 : 1)
    return { width, height }
  }
  return input
}

describe('faceLandmark68Net', () => {

  let imgEl1: HTMLImageElement
  let imgEl2: HTMLImageElement
  let imgElRect: HTMLImageElement
  let faceLandmarkPositions1: Point[]
  let faceLandmarkPositions2: Point[]
  let faceLandmarkPositionsRect: Point[]

  beforeAll(async () => {
    imgEl1 = await fetchImage('base/test/images/face1.png')
    imgEl2 = await fetchImage('base/test/images/face2.png')
    imgElRect = await fetchImage('base/test/images/face_rectangular.png')
    faceLandmarkPositions1 = await fetchJson<Point[]>('base/test/data/faceLandmarkPositions1.json')
    faceLandmarkPositions2 = await fetchJson<Point[]>('base/test/data/faceLandmarkPositions2.json')
    faceLandmarkPositionsRect = await fetchJson<Point[]>('base/test/data/faceLandmarkPositionsRect.json')
  })

  describeWithNets('quantized weights', { withFaceLandmark68Net: { quantized: true } }, ({ faceLandmark68Net }) => {

    it('computes face landmarks for squared input', async () => {
      const { width, height } = imgEl1

      const result = await faceLandmark68Net.detectLandmarks(imgEl1) as FaceLandmarks68
      expect(result.imageWidth).toEqual(width)
      expect(result.imageHeight).toEqual(height)
      expect(result.shift.x).toEqual(0)
      expect(result.shift.y).toEqual(0)
      result.positions.forEach((pt, i) => {
        const { x, y } = faceLandmarkPositions1[i]
        expectPointClose(pt, { x, y }, 2)
      })
    })

    it('computes face landmarks for rectangular input', async () => {
      const { width, height } = imgElRect

      const result = await faceLandmark68Net.detectLandmarks(imgElRect) as FaceLandmarks68
      expect(result.imageWidth).toEqual(width)
      expect(result.imageHeight).toEqual(height)
      expect(result.shift.x).toEqual(0)
      expect(result.shift.y).toEqual(0)
      result.positions.forEach((pt, i) => {
        const { x, y } = faceLandmarkPositionsRect[i]
        expectPointClose(pt, { x, y }, 6)
      })
    })

  })

  describeWithNets('batch inputs', { withFaceLandmark68Net: { quantized: true } }, ({ faceLandmark68Net }) => {

    it('computes face landmarks for batch of image elements', async () => {
      const inputs = [imgEl1, imgEl2, imgElRect]

      const faceLandmarkPositions = [
        faceLandmarkPositions1,
        faceLandmarkPositions2,
        faceLandmarkPositionsRect
      ]

      const results = await faceLandmark68Net.detectLandmarks(inputs) as FaceLandmarks68[]
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toEqual(3)
      results.forEach((result, batchIdx) => {
        const { width, height } = getInputDims(inputs[batchIdx])
        expect(result.imageWidth).toEqual(width)
        expect(result.imageHeight).toEqual(height)
        expect(result.shift.x).toEqual(0)
        expect(result.shift.y).toEqual(0)
        result.positions.forEach(({ x, y }, i) => {
          expectMaxDelta(x, faceLandmarkPositions[batchIdx][i].x, 2)
          expectMaxDelta(y, faceLandmarkPositions[batchIdx][i].y, 2)
        })
      })
    })

    it('computes face landmarks for batch of tf.Tensor3D', async () => {
      const inputs = [imgEl1, imgEl2, imgElRect].map(el => tf.fromPixels(el))

      const faceLandmarkPositions = [
        faceLandmarkPositions1,
        faceLandmarkPositions2,
        faceLandmarkPositionsRect
      ]

      const results = await faceLandmark68Net.detectLandmarks(inputs) as FaceLandmarks68[]
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toEqual(3)
      results.forEach((result, batchIdx) => {
        const { width, height } = getInputDims(inputs[batchIdx])
        expect(result.imageWidth).toEqual(width)
        expect(result.imageHeight).toEqual(height)
        expect(result.shift.x).toEqual(0)
        expect(result.shift.y).toEqual(0)
        result.positions.forEach(({ x, y }, i) => {
          expectMaxDelta(x, faceLandmarkPositions[batchIdx][i].x, 3)
          expectMaxDelta(y, faceLandmarkPositions[batchIdx][i].y, 3)
        })
      })
    })

    it('computes face landmarks for batch of mixed inputs', async () => {
      const inputs = [imgEl1, tf.fromPixels(imgEl2), tf.fromPixels(imgElRect)]

      const faceLandmarkPositions = [
        faceLandmarkPositions1,
        faceLandmarkPositions2,
        faceLandmarkPositionsRect
      ]

      const results = await faceLandmark68Net.detectLandmarks(inputs) as FaceLandmarks68[]
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toEqual(3)
      results.forEach((result, batchIdx) => {
        const { width, height } = getInputDims(inputs[batchIdx])
        expect(result.imageWidth).toEqual(width)
        expect(result.imageHeight).toEqual(height)
        expect(result.shift.x).toEqual(0)
        expect(result.shift.y).toEqual(0)
        result.positions.forEach(({ x, y }, i) => {
          expectMaxDelta(x, faceLandmarkPositions[batchIdx][i].x, 3)
          expectMaxDelta(y, faceLandmarkPositions[batchIdx][i].y, 3)
        })
      })
    })

  })

  describeWithNets('no memory leaks', { withFaceLandmark68Net: { quantized: true } }, ({ faceLandmark68Net }) => {

    describe('NeuralNetwork, uncompressed model', () => {

      it('disposes all param tensors', async () => {
        await expectAllTensorsReleased(async () => {
          const res = await fetch('base/weights_uncompressed/face_landmark_68_model.weights')
          const weights = new Float32Array(await res.arrayBuffer())
          const net = createFaceLandmarkNet(weights)
          net.dispose()
        })
      })

    })

    describe('NeuralNetwork, quantized model', () => {

      it('disposes all param tensors', async () => {
        await expectAllTensorsReleased(async () => {
          const net = new FaceLandmark68Net()
          await net.load('base/weights')
          net.dispose()
        })
      })

    })

    describe('forwardInput', () => {

      it('single image element', async () => {
        await expectAllTensorsReleased(async () => {
          const netInput = new NetInput([imgEl1])
          const outTensor = await faceLandmark68Net.forwardInput(netInput)
          outTensor.dispose()
        })
      })

      it('multiple image elements', async () => {
        await expectAllTensorsReleased(async () => {
          const netInput = new NetInput([imgEl1, imgEl1, imgEl1])
          const outTensor = await faceLandmark68Net.forwardInput(netInput)
          outTensor.dispose()
        })
      })

      it('single tf.Tensor3D', async () => {
        const tensor = tf.fromPixels(imgEl1)

        await expectAllTensorsReleased(async () => {
          const netInput = new NetInput([tensor])
          const outTensor = await faceLandmark68Net.forwardInput(netInput)
          outTensor.dispose()
        })

        tensor.dispose()
      })

      it('multiple tf.Tensor3Ds', async () => {
        const tensors = [imgEl1, imgEl1, imgEl1].map(el => tf.fromPixels(el))

        await expectAllTensorsReleased(async () => {
          const netInput = new NetInput(tensors)
          const outTensor = await faceLandmark68Net.forwardInput(netInput)
          outTensor.dispose()
        })

        tensors.forEach(t => t.dispose())
      })

      it('single batch size 1 tf.Tensor4Ds', async () => {
        const tensor = tf.tidy(() => tf.fromPixels(imgEl1).expandDims()) as tf.Tensor4D

        await expectAllTensorsReleased(async () => {
          const outTensor = await faceLandmark68Net.forwardInput(await toNetInput(tensor))
          outTensor.dispose()
        })

        tensor.dispose()
      })

      it('multiple batch size 1 tf.Tensor4Ds', async () => {
        const tensors = [imgEl1, imgEl1, imgEl1]
          .map(el => tf.tidy(() => tf.fromPixels(el).expandDims())) as tf.Tensor4D[]

        await expectAllTensorsReleased(async () => {
          const outTensor = await faceLandmark68Net.forwardInput(await toNetInput(tensors))
          outTensor.dispose()
        })

        tensors.forEach(t => t.dispose())
      })

    })

    describe('detectLandmarks', () => {

      it('single image element', async () => {
        await expectAllTensorsReleased(async () => {
          await faceLandmark68Net.detectLandmarks(imgEl1)
        })
      })

      it('multiple image elements', async () => {
        await expectAllTensorsReleased(async () => {
          await faceLandmark68Net.detectLandmarks([imgEl1, imgEl1, imgEl1])
        })
      })

      it('single tf.Tensor3D', async () => {
        const tensor = tf.fromPixels(imgEl1)

        await expectAllTensorsReleased(async () => {
          await faceLandmark68Net.detectLandmarks(tensor)
        })

        tensor.dispose()
      })

      it('multiple tf.Tensor3Ds', async () => {
        const tensors = [imgEl1, imgEl1, imgEl1].map(el => tf.fromPixels(el))


        await expectAllTensorsReleased(async () => {
          await faceLandmark68Net.detectLandmarks(tensors)
        })

        tensors.forEach(t => t.dispose())
      })

      it('single batch size 1 tf.Tensor4Ds', async () => {
        const tensor = tf.tidy(() => tf.fromPixels(imgEl1).expandDims()) as tf.Tensor4D

        await expectAllTensorsReleased(async () => {
          await faceLandmark68Net.detectLandmarks(tensor)
        })

        tensor.dispose()
      })

      it('multiple batch size 1 tf.Tensor4Ds', async () => {
        const tensors = [imgEl1, imgEl1, imgEl1]
          .map(el => tf.tidy(() => tf.fromPixels(el).expandDims())) as tf.Tensor4D[]

        await expectAllTensorsReleased(async () => {
          await faceLandmark68Net.detectLandmarks(tensors)
        })

        tensors.forEach(t => t.dispose())
      })

    })
  })

})

